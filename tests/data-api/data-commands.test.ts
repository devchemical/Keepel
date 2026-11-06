import { beforeAll, expect, test } from "vitest"
import { randomUUID } from "node:crypto"
import type { DataCommand } from "../../lib/data/data-command"
import { createAccount, prepareDatabase } from "./support"

let alice: Awaited<ReturnType<typeof createAccount>>
beforeAll(async () => {
  prepareDatabase(8)
  alice = await createAccount("crud-alice")
}, 60000)

test("CRUD receipts confirm affected rows, retain immutable identity and survive cascading deletion", async () => {
  const operationId = randomUUID()
  const id = randomUUID()
  const create = {
    p_operation_id: operationId,
    p_action: "vehicle.create",
    p_id: id,
    p_values: { make: "Receipt", model: "Test", year: 2026, mileage: 0, license_plate: null, vin: null, color: null },
  }
  const saved = await alice.client.rpc("mutate_data", create)
  expect(saved.error).toBeNull()
  expect(saved.data).toMatchObject({ operation_id: operationId, action: "vehicle.create", row: { id, mileage: 0 } })
  expect((await alice.client.rpc("mutate_data", create)).data).toEqual(saved.data)
  expect(
    (await alice.client.rpc("mutate_data", { ...create, p_values: { ...create.p_values, make: "Changed" } })).error
  ).not.toBeNull()
  const bob = await createAccount("crud-bob")
  expect((await bob.client.rpc("get_data_operation", { p_operation_id: operationId })).data).toBeNull()
  expect(
    (
      await bob.client.rpc("mutate_data", {
        p_operation_id: randomUUID(),
        p_action: "vehicle.delete",
        p_id: id,
        p_values: {},
      })
    ).error
  ).not.toBeNull()
  const missingOperation = randomUUID()
  expect(
    (
      await alice.client.rpc("mutate_data", {
        p_operation_id: missingOperation,
        p_action: "vehicle.delete",
        p_id: randomUUID(),
        p_values: {},
      })
    ).error
  ).not.toBeNull()
  expect((await alice.client.rpc("get_data_operation", { p_operation_id: missingOperation })).data).toBeNull()
  const scheduleId = randomUUID()
  const schedule = await alice.client.rpc("mutate_data", {
    p_operation_id: randomUUID(),
    p_action: "schedule.create",
    p_id: scheduleId,
    p_values: {
      vehicle_id: id,
      type: "oil_change",
      scheduled_date: null,
      scheduled_mileage: 0,
      notes: null,
      description: null,
    },
  })
  expect(schedule.error).toBeNull()
  const deletedId = randomUUID()
  expect(
    (
      await alice.client.rpc("mutate_data", {
        p_operation_id: deletedId,
        p_action: "vehicle.delete",
        p_id: id,
        p_values: {},
      })
    ).error
  ).toBeNull()
  expect((await alice.client.from("scheduled_services").select("id").eq("id", scheduleId)).data).toEqual([])
  expect((await alice.client.rpc("get_data_operation", { p_operation_id: deletedId })).data).toMatchObject({
    action: "vehicle.delete",
    row: { id },
  })
})

test("a real committed write with a lost response stays unknown until an explicit receipt read; native errors remain rejected", async () => {
  const { executeDataCommand, queryDataOperation } = await import("../../lib/data/data-command")
  let attempts = 0
  const account = await createAccount("lost-response", (async (input, init) => {
    const response = await fetch(input, init)
    if (String(input).endsWith("/rpc/mutate_data")) {
      attempts++
      if (response.ok) return new Response(JSON.stringify({ message: "Lost response" }), { status: 503 })
    }
    return response
  }) as typeof fetch)
  const command = {
    operationId: randomUUID(),
    action: "vehicle.create" as const,
    id: randomUUID(),
    values: {
      make: "One",
      model: "Write",
      year: 2026,
      mileage: 0,
      license_plate: null,
      color: null,
      vin: null,
    },
  }
  expect(await executeDataCommand(account.client, account.id, command)).toEqual({ status: "unknown" })
  expect(attempts).toBe(1)
  const confirmed = await queryDataOperation(account.client, account.id, command)
  expect(confirmed).toMatchObject({
    status: "success",
    receipt: { operation_id: command.operationId, row: { id: command.id, mileage: 0 } },
  })
  expect(attempts).toBe(1)
  expect((await account.client.from("vehicles").select("id")).data).toEqual([{ id: command.id }])
  expect(
    await executeDataCommand(account.client, account.id, {
      operationId: randomUUID(),
      action: "vehicle.delete",
      id: randomUUID(),
      values: {},
    })
  ).toEqual({ status: "rejected" })
})

test("the RPC boundary rejects incomplete schedules, partial numeric parses and non-calendar dates without receipts", async () => {
  const vehicle = await alice.client
    .from("vehicles")
    .insert({ user_id: alice.id, make: "Boundary", model: "Values", year: 2026 })
    .select()
    .single()
  if (vehicle.error) throw vehicle.error
  for (const invalid of [
    { scheduled_date: null, scheduled_mileage: null },
    { scheduled_date: "2026-1-1", scheduled_mileage: null },
    { scheduled_date: null, scheduled_mileage: 1.5 },
    { scheduled_date: null, scheduled_mileage: "12oops" },
    { scheduled_date: null, scheduled_mileage: -1 },
  ]) {
    const operationId = randomUUID()
    const result = await alice.client.rpc("mutate_data", {
      p_operation_id: operationId,
      p_action: "schedule.create",
      p_id: randomUUID(),
      p_values: { vehicle_id: vehicle.data.id, type: "other", description: null, notes: null, ...invalid },
    })
    expect(result.error).not.toBeNull()
    expect((await alice.client.rpc("get_data_operation", { p_operation_id: operationId })).data).toBeNull()
  }
})

test("maintenance edits and deletion use confirmed receipts and deletion restores a linked forecast", async () => {
  const vehicle = await alice.client
    .from("vehicles")
    .insert({ user_id: alice.id, make: "History", model: "Owner", year: 2026, mileage: 100 })
    .select()
    .single()
  if (vehicle.error) throw vehicle.error
  const scheduledId = randomUUID()
  const schedule = await alice.client.rpc("mutate_data", {
    p_operation_id: randomUUID(),
    p_action: "schedule.create",
    p_id: scheduledId,
    p_values: {
      vehicle_id: vehicle.data.id,
      type: "other",
      scheduled_date: "2026-01-01",
      scheduled_mileage: null,
      description: null,
      notes: null,
    },
  })
  expect(schedule.error).toBeNull()
  const batch = await alice.client.rpc("create_maintenance_batch", {
    p_operation_id: randomUUID(),
    p_vehicle_id: vehicle.data.id,
    p_today: "2026-01-01",
    p_batch: {
      service_date: "2026-01-01",
      mileage: 100,
      notes: null,
      services: [{ type: "other", description: "Before", cost: 42 }],
    },
    p_completion: { scheduled_service_id: scheduledId, service_index: 0 },
  })
  expect(batch.error).toBeNull()
  const recordId = batch.data.records[0].id
  const edit = await alice.client.rpc("mutate_data", {
    p_operation_id: randomUUID(),
    p_action: "maintenance.update",
    p_id: recordId,
    p_values: { type: "oil_change", service_date: "2025-01-01", mileage: 0, cost: 0, description: null, notes: null },
  })
  expect(edit.error).toBeNull()
  expect(edit.data).toMatchObject({
    row: { id: recordId, cost: 0, mileage: 0, description: null, service_date: "2025-01-01" },
  })
  expect((await alice.client.from("vehicles").select("mileage").eq("id", vehicle.data.id).single()).data?.mileage).toBe(
    100
  )
  const deletion = await alice.client.rpc("mutate_data", {
    p_operation_id: randomUUID(),
    p_action: "maintenance.delete",
    p_id: recordId,
    p_values: {},
  })
  expect(deletion.error).toBeNull()
  expect(deletion.data).toMatchObject({ action: "maintenance.delete", row: { id: recordId } })
  expect((await alice.client.from("maintenance_records").select("id").eq("vehicle_id", vehicle.data.id)).data).toEqual(
    []
  )
  expect(
    (await alice.client.from("scheduled_services").select("status,completed_record_id").eq("id", scheduledId).single())
      .data
  ).toEqual({ status: "pending", completed_record_id: null })
})

test("sparse complete updates fail at the command boundary and SQL guard without clearing stored fields", async () => {
  const { executeDataCommand } = await import("../../lib/data/data-command")
  const vehicle = await alice.client
    .from("vehicles")
    .insert({ user_id: alice.id, make: "Before", model: "Sparse", year: 2020, mileage: 42, color: "blue" })
    .select()
    .single()
  if (!vehicle.data) throw new Error("Missing fixture")
  const record = await alice.client
    .from("maintenance_records")
    .insert({
      user_id: alice.id,
      vehicle_id: vehicle.data.id,
      type: "other",
      service_date: "2026-11-06",
      notes: "retain",
      cost: 42,
    })
    .select()
    .single()
  const schedule = await alice.client
    .from("scheduled_services")
    .insert({
      user_id: alice.id,
      vehicle_id: vehicle.data.id,
      type: "other",
      scheduled_date: "2026-11-06",
      notes: "retain",
      scheduled_mileage: 42,
    })
    .select()
    .single()
  if (!record.data || !schedule.data) throw new Error("Missing fixture")
  const cases = [
    { action: "vehicle.update", table: "vehicles", row: vehicle.data, values: { make: "A", model: "B", year: 2020 } },
    {
      action: "maintenance.update",
      table: "maintenance_records",
      row: record.data,
      values: { type: "other", service_date: "2026-11-06" },
    },
    {
      action: "schedule.update",
      table: "scheduled_services",
      row: schedule.data,
      values: { type: "other", scheduled_date: "2026-11-06" },
    },
  ] as const
  for (const { action, table, row, values } of cases) {
    const operationId = randomUUID()
    await expect(
      executeDataCommand(alice.client, alice.id, {
        operationId,
        action,
        id: row.id,
        values,
      } as unknown as DataCommand)
    ).rejects.toThrow()
    expect(
      (
        await alice.client.rpc("mutate_data", {
          p_operation_id: operationId,
          p_action: action,
          p_id: row.id,
          p_values: values,
        })
      ).error
    ).not.toBeNull()
    expect((await alice.client.from(table).select().eq("id", row.id).single()).data).toEqual(row)
  }
})
