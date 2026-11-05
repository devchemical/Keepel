import { randomUUID } from "node:crypto"
import { beforeAll, expect, test } from "vitest"
import { createAccount, prepareDatabase } from "./support"

let alice: Awaited<ReturnType<typeof createAccount>>
let vehicleId: string
beforeAll(async () => {
  prepareDatabase(7)
  alice = await createAccount("batch")
  const vehicle = await alice.client
    .from("vehicles")
    .insert({ user_id: alice.id, make: "Test", model: "Batch", year: 2020, mileage: 10 })
    .select()
    .single()
  if (vehicle.error) throw vehicle.error
  vehicleId = vehicle.data.id
}, 120_000)

const batch = (services: unknown[], mileage: number | null = 0, service_date = "2026-01-02") => ({
  service_date,
  mileage,
  notes: null,
  services,
})
const service = { type: "oil_change", description: null, cost: 0 }
function command(payload: unknown = batch([service]), operation = randomUUID()) {
  return alice.client.rpc("create_maintenance_batch", {
    p_operation_id: operation,
    p_vehicle_id: vehicleId,
    p_today: "2026-01-02",
    p_batch: payload,
  })
}

test("a valid batch preserves zero and null; an invalid nonempty row rolls back the entire batch", async () => {
  const valid = await command(batch([service, { type: "other", cost: null, description: null }]))
  expect(valid.error).toBeNull()
  expect(valid.data.records).toHaveLength(2)
  expect(valid.data.records[0]).toMatchObject({ cost: 0, mileage: 0, description: null, notes: null })
  expect(valid.data.records[1].cost).toBeNull()
  const invalid = await command(batch([service, { description: "incomplete" }], 500))
  expect(invalid.error).not.toBeNull()
  const records = await alice.client.from("maintenance_records").select("id").eq("vehicle_id", vehicleId)
  expect(records.error).toBeNull()
  expect(records.data).toHaveLength(2)
  const vehicle = await alice.client.from("vehicles").select("mileage").eq("id", vehicleId).single()
  expect(vehicle.data?.mileage).toBe(10)
})

test("operation identity reconciles and replays exactly once, including concurrent retries", async () => {
  const operation = randomUUID()
  const payload = batch([service], 100)
  const attempts = await Promise.all([command(payload, operation), command(payload, operation)])
  for (const attempt of attempts) expect(attempt.error).toBeNull()
  expect(attempts[0].data).toEqual(attempts[1].data)
  const reconciled = await alice.client.rpc("get_maintenance_batch_operation", { p_operation_id: operation })
  expect(reconciled.error).toBeNull()
  expect(reconciled.data).toEqual(attempts[0].data)
  const rows = await alice.client
    .from("maintenance_records")
    .select("id")
    .in(
      "id",
      attempts[0].data.records.map((row: { id: string }) => row.id)
    )
  expect(rows.data).toHaveLength(1)
  expect((await command(batch([service], 101), operation)).error).not.toBeNull()
  const absent = await alice.client.rpc("get_maintenance_batch_operation", { p_operation_id: randomUUID() })
  expect(absent.error).toBeNull()
  expect(absent.data).toBeNull()
})

test("only nonfuture performed days raise mileage; history, edits, deletes and concurrent batches never lower it", async () => {
  expect((await command(batch([service], 50000, "2026-01-03"))).error).toBeNull()
  const current = () => alice.client.from("vehicles").select("mileage").eq("id", vehicleId).single()
  expect((await current()).data?.mileage).toBe(100)
  const results = await Promise.all([command(batch([service], 2000)), command(batch([service], 1000, "2020-01-01"))])
  results.forEach((result) => expect(result.error).toBeNull())
  expect((await current()).data?.mileage).toBe(2000)
  const historical = await command(batch([service], 50, "2019-01-01"))
  expect(historical.error).toBeNull()
  const id = historical.data.records[0].id
  expect(
    (await alice.client.from("maintenance_records").update({ mileage: 1 }).eq("id", id).select()).data
  ).toHaveLength(1)
  expect((await alice.client.from("maintenance_records").delete().eq("id", id).select()).data).toHaveLength(1)
  expect((await current()).data?.mileage).toBe(2000)
  expect((await command(batch([service], null))).data.records[0].mileage).toBeNull()
})

test("explicit completion chooses a row of the same vehicle and rolls back invalid or repeated resolution", async () => {
  const schedule = await alice.client
    .from("scheduled_services")
    .insert({ user_id: alice.id, vehicle_id: vehicleId, type: "oil_change", scheduled_mileage: 100 })
    .select()
    .single()
  expect(schedule.error).toBeNull()
  const completion = { scheduled_service_id: schedule.data.id, service_index: 1 }
  const args = {
    p_operation_id: randomUUID(),
    p_vehicle_id: vehicleId,
    p_today: "2026-01-02",
    p_batch: batch([service, { ...service, type: "other" }]),
    p_completion: completion,
  }
  const done = await alice.client.rpc("create_maintenance_batch", args)
  expect(done.error).toBeNull()
  expect(done.data.scheduled_service).toMatchObject({
    status: "completed",
    completed_record_id: done.data.records[1].id,
  })
  expect((await alice.client.rpc("create_maintenance_batch", args)).data).toEqual(done.data)
  expect(
    (await alice.client.rpc("create_maintenance_batch", { ...args, p_operation_id: randomUUID() })).error
  ).not.toBeNull()
  // An unrelated batch does not infer completion by maintenance type.
  const pending = await alice.client
    .from("scheduled_services")
    .insert({ user_id: alice.id, vehicle_id: vehicleId, type: "oil_change", scheduled_date: "2026-01-02" })
    .select()
    .single()
  await command()
  expect(
    (await alice.client.from("scheduled_services").select("status").eq("id", pending.data.id).single()).data?.status
  ).toBe("pending")
  const otherVehicle = await alice.client
    .from("vehicles")
    .insert({ user_id: alice.id, make: "Test", model: "Other", year: 2020 })
    .select()
    .single()
  const before = await alice.client.from("maintenance_records").select("id").eq("vehicle_id", otherVehicle.data.id)
  const wrongVehicle = await alice.client.rpc("create_maintenance_batch", {
    ...args,
    p_operation_id: randomUUID(),
    p_vehicle_id: otherVehicle.data.id,
    p_completion: { ...completion, scheduled_service_id: pending.data.id },
  })
  expect(wrongVehicle.error).not.toBeNull()
  expect(
    (await alice.client.from("maintenance_records").select("id").eq("vehicle_id", otherVehicle.data.id)).data
  ).toEqual(before.data)
  expect(
    (
      await alice.client
        .from("scheduled_services")
        .update({ status: "completed", completed_record_id: done.data.records[0].id })
        .eq("id", pending.data.id)
        .select()
    ).error
  ).toBeNull()
  const wrongRecord = await alice.client
    .from("maintenance_records")
    .insert({ user_id: alice.id, vehicle_id: otherVehicle.data.id, type: "other", service_date: "2026-01-01" })
    .select()
    .single()
  expect(
    (
      await alice.client
        .from("scheduled_services")
        .update({ completed_record_id: wrongRecord.data.id })
        .eq("id", pending.data.id)
    ).error
  ).not.toBeNull()
  expect(
    (
      await alice.client
        .from("scheduled_services")
        .update({ status: "completed", completed_record_id: null })
        .eq("id", pending.data.id)
    ).error
  ).toBeNull() // clearing explicitly restores pending
  expect(
    (await alice.client.from("maintenance_records").delete().eq("id", done.data.records[1].id).select()).error
  ).toBeNull()
  expect(
    (
      await alice.client
        .from("scheduled_services")
        .select("status,completed_record_id")
        .eq("id", schedule.data.id)
        .single()
    ).data
  ).toEqual({ status: "pending", completed_record_id: null })
})

test("API and constraints reject malformed numbers, types, dates, and invalid completion without a receipt", async () => {
  const badPayloads = [
    batch([{ ...service, cost: -1 }]),
    batch([{ ...service, cost: -0.001 }]),
    batch([{ ...service, cost: "2e3" }]),
    batch([{ ...service, cost: "" }]),
    batch([{ ...service, type: "" }]),
    batch([{ ...service, type: "unknown" }]),
    batch([null]),
    batch([{}]),
    batch([]),
    { ...batch([service]), mileage: -1 },
    { ...batch([service]), mileage: 1.5 },
    { ...batch([service]), mileage: "0" },
    { ...batch([service]), service_date: "2026-02-30" },
    { ...batch([service]), service_date: "2026-01-02T00:00:00Z" },
  ]
  for (const payload of badPayloads) {
    const operation = randomUUID()
    expect((await command(payload, operation)).error, JSON.stringify(payload)).not.toBeNull()
    expect((await alice.client.rpc("get_maintenance_batch_operation", { p_operation_id: operation })).data).toBeNull()
  }
  for (const invalid of [{ cost: -0.001 }, { cost: -1 }, { mileage: -1 }, { cost: "NaN" }, { type: " " }]) {
    expect(
      (
        await alice.client
          .from("maintenance_records")
          .insert({ user_id: alice.id, vehicle_id: vehicleId, service_date: "2026-01-02", type: "other", ...invalid })
      ).error
    ).not.toBeNull()
  }
  expect((await alice.client.from("vehicles").update({ year: -1 }).eq("id", vehicleId)).error).not.toBeNull()
  expect((await alice.client.from("vehicles").update({ make: " " }).eq("id", vehicleId)).error).not.toBeNull()
  expect(
    (
      await alice.client
        .from("scheduled_services")
        .insert({ user_id: alice.id, vehicle_id: vehicleId, type: "other", scheduled_mileage: -1 })
    ).error
  ).not.toBeNull()
})

test("ordinary accounts cannot use another owner's vehicle, forecast, or operation receipt", async () => {
  const bob = await createAccount("batch-bob")
  const operation = randomUUID()
  const own = await command(batch([service]), operation)
  expect(own.error).toBeNull()
  const args = { p_operation_id: operation, p_vehicle_id: vehicleId, p_today: "2026-01-02", p_batch: batch([service]) }
  expect((await bob.client.rpc("create_maintenance_batch", args)).error).not.toBeNull()
  const receipt = await bob.client.rpc("get_maintenance_batch_operation", { p_operation_id: operation })
  expect(receipt.error).toBeNull()
  expect(receipt.data).toBeNull()
  expect(
    (
      await bob.client
        .from("maintenance_records")
        .insert({ user_id: bob.id, vehicle_id: vehicleId, type: "other", service_date: "2026-01-01" })
    ).error
  ).not.toBeNull()
  const { ordinaryClient } = await import("./support")
  expect((await ordinaryClient().rpc("create_maintenance_batch", args)).error).not.toBeNull()
})

test("future, cancelled, invalid-row and concurrent completions preserve transactional integrity", async () => {
  const makeForecast = async () => {
    const result = await alice.client
      .from("scheduled_services")
      .insert({ user_id: alice.id, vehicle_id: vehicleId, type: "other", scheduled_mileage: 3000 })
      .select()
      .single()
    if (result.error) throw result.error
    return result.data.id
  }
  const forecast = await makeForecast()
  const args = {
    p_operation_id: randomUUID(),
    p_vehicle_id: vehicleId,
    p_today: "2026-01-02",
    p_batch: batch([service]),
    p_completion: { scheduled_service_id: forecast, service_index: 0 },
  }
  const before = await alice.client.from("maintenance_records").select("id").eq("vehicle_id", vehicleId)
  for (const changes of [
    { p_batch: batch([service], 100000, "2026-01-03") },
    { p_batch: batch([service, { description: "incomplete" }], 100000) },
    { p_completion: { ...args.p_completion, service_index: 4 } },
    { p_completion: { ...args.p_completion, service_index: -1 } },
  ]) {
    const operation = randomUUID()
    const result = await alice.client.rpc("create_maintenance_batch", {
      ...args,
      ...changes,
      p_operation_id: operation,
    })
    expect(result.error).not.toBeNull()
    expect((await alice.client.rpc("get_maintenance_batch_operation", { p_operation_id: operation })).data).toBeNull()
  }
  expect((await alice.client.from("maintenance_records").select("id").eq("vehicle_id", vehicleId)).data).toEqual(
    before.data
  )
  expect(
    (await alice.client.from("scheduled_services").select("status,completed_record_id").eq("id", forecast).single())
      .data
  ).toEqual({ status: "pending", completed_record_id: null })
  expect((await alice.client.from("vehicles").select("mileage").eq("id", vehicleId).single()).data?.mileage).toBe(2000)
  const attempts = await Promise.all([
    alice.client.rpc("create_maintenance_batch", args),
    alice.client.rpc("create_maintenance_batch", { ...args, p_operation_id: randomUUID() }),
  ])
  expect(attempts.filter((result) => result.error === null)).toHaveLength(1)
  expect(attempts.filter((result) => result.error !== null)).toHaveLength(1)
  const cancelled = await makeForecast()
  expect(
    (await alice.client.from("scheduled_services").update({ status: "cancelled" }).eq("id", cancelled)).error
  ).toBeNull()
  expect(
    (
      await alice.client.rpc("create_maintenance_batch", {
        ...args,
        p_operation_id: randomUUID(),
        p_completion: { scheduled_service_id: cancelled, service_index: 0 },
      })
    ).error
  ).not.toBeNull()
})

test("script 007 replay keeps existing nested vehicle reads and vehicle cascades working", async () => {
  const { replayScript } = await import("./support")
  replayScript(7)
  for (const table of ["maintenance_records", "scheduled_services"]) {
    const result = await alice.client.from(table).select("id,vehicles(make,model,year)")
    expect(result.error).toBeNull()
  }
  const removed = await alice.client.from("vehicles").delete().eq("id", vehicleId).select("id")
  expect(removed.error).toBeNull()
  expect(removed.data).toEqual([{ id: vehicleId }])
  expect((await alice.client.from("maintenance_records").select("id").eq("vehicle_id", vehicleId)).data).toEqual([])
  expect((await alice.client.from("scheduled_services").select("id").eq("vehicle_id", vehicleId)).data).toEqual([])
})
