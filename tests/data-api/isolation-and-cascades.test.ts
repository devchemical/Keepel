import { afterAll, beforeAll, expect, test } from "vitest"
import { createAccount, ordinaryClient, prepareDatabase } from "./support"

type Account = Awaited<ReturnType<typeof createAccount>>
let alice: Account
let bob: Account

beforeAll(async () => {
  prepareDatabase()
  alice = await createAccount("alice")
  bob = await createAccount("bob")
}, 120_000)

afterAll(async () => {
  await alice?.client.auth.signOut()
  await bob?.client.auth.signOut()
})

async function createVehicleWithHistory(account: Account) {
  const vehicle = await account.client
    .from("vehicles")
    .insert({
      user_id: account.id,
      make: "Synthetic",
      model: "API fixture",
      year: 2020,
      mileage: 0,
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
      cost: 0,
      mileage: 0,
    })
    .select("id")
    .single()
  if (record.error) throw record.error
  const schedule = await account.client
    .from("scheduled_services")
    .insert({
      user_id: account.id,
      vehicle_id: vehicle.data.id,
      type: "oil_change",
      scheduled_mileage: 12000,
      scheduled_date: null,
    })
    .select("id")
    .single()
  if (schedule.error) throw schedule.error
  return { vehicle: vehicle.data.id, record: record.data.id, schedule: schedule.data.id }
}

test("two ordinary accounts can read and mutate only their own rows", async () => {
  const a = await createVehicleWithHistory(alice)
  const b = await createVehicleWithHistory(bob)
  for (const [owner, other, ownIds, otherIds] of [
    [alice, bob, a, b],
    [bob, alice, b, a],
  ] as const) {
    for (const [table, ownId, otherId] of [
      ["profiles", owner.id, other.id],
      ["vehicles", ownIds.vehicle, otherIds.vehicle],
      ["maintenance_records", ownIds.record, otherIds.record],
      ["scheduled_services", ownIds.schedule, otherIds.schedule],
    ]) {
      const visible = await owner.client.from(table).select("id")
      expect(visible.error).toBeNull()
      expect(visible.data).toEqual([{ id: ownId }])
      const update =
        table === "profiles" ? { full_name: "Other" } : table === "vehicles" ? { model: "Other" } : { notes: "Other" }
      const changed = await owner.client.from(table).update(update).eq("id", otherId).select("id")
      expect(changed.error).toBeNull()
      expect(changed.data).toEqual([])
      const removed = await owner.client.from(table).delete().eq("id", otherId).select("id")
      expect(removed.error).toBeNull()
      expect(removed.data).toEqual([])
      const persisted = await other.client.from(table).select("id").eq("id", otherId)
      expect(persisted.error).toBeNull()
      expect(persisted.data).toEqual([{ id: otherId }])
    }
  }

  const updated = await alice.client
    .from("vehicles")
    .update({ model: "Updated" })
    .eq("id", a.vehicle)
    .select("model")
    .single()
  expect(updated.error).toBeNull()
  expect(updated.data).toEqual({ model: "Updated" })
  const anonymous = ordinaryClient()
  for (const table of ["profiles", "vehicles", "maintenance_records", "scheduled_services"]) {
    const result = await anonymous.from(table).select("id")
    expect(result.error).toBeNull()
    expect(result.data).toEqual([])
  }
})

test("deleting a vehicle removes its history and schedules while preserving the other account", async () => {
  const a = await createVehicleWithHistory(alice)
  const b = await createVehicleWithHistory(bob)
  const deleted = await alice.client.from("vehicles").delete().eq("id", a.vehicle).select("id")
  expect(deleted.error).toBeNull()
  expect(deleted.data).toEqual([{ id: a.vehicle }])
  for (const [table, removedId, retainedId] of [
    ["vehicles", a.vehicle, b.vehicle],
    ["maintenance_records", a.record, b.record],
    ["scheduled_services", a.schedule, b.schedule],
  ]) {
    const gone = await alice.client.from(table).select("id").eq("id", removedId)
    expect(gone.error).toBeNull()
    expect(gone.data).toEqual([])
    const retained = await bob.client.from(table).select("id").eq("id", retainedId)
    expect(retained.error).toBeNull()
    expect(retained.data).toEqual([{ id: retainedId }])
  }
})

test("script 006 removes both legacy forecast fields from the API", async () => {
  for (const column of ["next_service_date", "next_service_mileage"]) {
    const result = await alice.client.from("maintenance_records").select(column)
    expect(result.error).not.toBeNull()
    expect(result.data).toBeNull()
  }
})
