import { afterAll, beforeAll, expect, test } from "vitest"
import { createAccount, prepareDatabase, replayScript } from "./support"

let account: Awaited<ReturnType<typeof createAccount>>

beforeAll(async () => {
  prepareDatabase(4)
  account = await createAccount("migration")
}, 120_000)

afterAll(async () => {
  await account?.client.auth.signOut()
})

test("preserves a mileage-only forecast as pending before dropping legacy columns", async () => {
  const vehicle = await account.client
    .from("vehicles")
    .insert({
      user_id: account.id,
      make: "Synthetic",
      model: "Migration",
      year: 2020,
    })
    .select("id")
    .single()
  if (vehicle.error) throw vehicle.error
  const record = await account.client
    .from("maintenance_records")
    .insert({
      user_id: account.id,
      vehicle_id: vehicle.data.id,
      type: "oil_change",
      service_date: "2025-01-01",
      next_service_date: null,
      next_service_mileage: 12000,
    })
    .select("id")
    .single()
  expect(record.error).toBeNull()

  replayScript(5)
  const forecasts = await account.client
    .from("scheduled_services")
    .select("scheduled_date, scheduled_mileage, status, completed_record_id")
    .eq("vehicle_id", vehicle.data.id)
  expect(forecasts.error).toBeNull()
  expect(forecasts.data).toEqual([
    {
      scheduled_date: null,
      scheduled_mileage: 12000,
      status: "pending",
      completed_record_id: null,
    },
  ])
})

test("replaying date-only forecasts with null mileage does not duplicate schedules", async () => {
  const vehicle = await account.client
    .from("vehicles")
    .insert({
      user_id: account.id,
      make: "Synthetic",
      model: "Date only",
      year: 2020,
    })
    .select("id")
    .single()
  if (vehicle.error) throw vehicle.error
  const record = await account.client.from("maintenance_records").insert({
    user_id: account.id,
    vehicle_id: vehicle.data.id,
    type: "brake_service",
    description: null,
    service_date: "2025-01-01",
    next_service_date: "2025-07-01",
    next_service_mileage: null,
  })
  expect(record.error).toBeNull()
  replayScript(5)
  const first = await account.client
    .from("scheduled_services")
    .select("id, scheduled_date, scheduled_mileage, status, completed_record_id")
    .eq("vehicle_id", vehicle.data.id)
  expect(first.error).toBeNull()
  expect(first.data).toEqual([
    {
      id: expect.any(String),
      scheduled_date: "2025-07-01",
      scheduled_mileage: null,
      status: "pending",
      completed_record_id: null,
    },
  ])
  replayScript(5)
  const repeated = await account.client
    .from("scheduled_services")
    .select("id, scheduled_date, scheduled_mileage, status, completed_record_id")
    .eq("vehicle_id", vehicle.data.id)
  expect(repeated.error).toBeNull()
  expect(repeated.data).toEqual(first.data)
})

test("keeps zero and combined criteria, omits absent criteria, and preserves results after 006", async () => {
  const vehicle = await account.client
    .from("vehicles")
    .insert({
      user_id: account.id,
      make: "Synthetic",
      model: "Nullable criteria",
      year: 2020,
    })
    .select("id")
    .single()
  if (vehicle.error) throw vehicle.error
  const seeded = await account.client.from("maintenance_records").insert([
    {
      user_id: account.id,
      vehicle_id: vehicle.data.id,
      type: "tire_rotation",
      service_date: "2025-01-01",
      description: null,
      next_service_date: null,
      next_service_mileage: 0,
    },
    {
      user_id: account.id,
      vehicle_id: vehicle.data.id,
      type: "oil_change",
      service_date: "2025-01-01",
      description: "Both criteria",
      next_service_date: "2025-08-01",
      next_service_mileage: 24000,
    },
    {
      user_id: account.id,
      vehicle_id: vehicle.data.id,
      type: "inspection",
      service_date: "2025-01-01",
      next_service_date: null,
      next_service_mileage: null,
    },
  ])
  expect(seeded.error).toBeNull()
  replayScript(5)
  const selection = "id, type, scheduled_date, scheduled_mileage, status, completed_record_id"
  const migrated = await account.client
    .from("scheduled_services")
    .select(selection)
    .eq("vehicle_id", vehicle.data.id)
    .order("type")
  expect(migrated.error).toBeNull()
  expect(migrated.data).toEqual([
    {
      id: expect.any(String),
      type: "oil_change",
      scheduled_date: "2025-08-01",
      scheduled_mileage: 24000,
      status: "pending",
      completed_record_id: null,
    },
    {
      id: expect.any(String),
      type: "tire_rotation",
      scheduled_date: null,
      scheduled_mileage: 0,
      status: "pending",
      completed_record_id: null,
    },
  ])
  const cancelled = await account.client
    .from("scheduled_services")
    .update({ status: "cancelled" })
    .eq("vehicle_id", vehicle.data.id)
    .eq("type", "tire_rotation")
  expect(cancelled.error).toBeNull()
  replayScript(5)
  replayScript(6)
  const retained = await account.client
    .from("scheduled_services")
    .select(selection)
    .eq("vehicle_id", vehicle.data.id)
    .order("type")
  expect(retained.error).toBeNull()
  expect(retained.data).toEqual([migrated.data?.[0], { ...migrated.data?.[1], status: "cancelled" }])
  const history = await account.client
    .from("maintenance_records")
    .select("type, service_date")
    .eq("vehicle_id", vehicle.data.id)
    .order("type")
  expect(history.error).toBeNull()
  expect(history.data).toEqual([
    { type: "inspection", service_date: "2025-01-01" },
    { type: "oil_change", service_date: "2025-01-01" },
    { type: "tire_rotation", service_date: "2025-01-01" },
  ])
  for (const column of ["next_service_date", "next_service_mileage"]) {
    const dropped = await account.client.from("maintenance_records").select(column)
    expect(dropped.error).not.toBeNull()
    expect(dropped.data).toBeNull()
  }
})
