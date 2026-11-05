import { beforeAll, expect, test } from "vitest"
import { randomUUID } from "node:crypto"
import { createAccount, prepareDatabase } from "./support"
import { executeDataCommand, type DataCommand } from "../../lib/data/data-command"
import { scheduledServiceSchema } from "../../lib/data/scheduled-command"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "../../lib/supabase/database.types"
async function scheduleCommand(
  client: SupabaseClient<Database>,
  userId: string,
  action: DataCommand["action"],
  id: string,
  values: unknown
) {
  const result = await executeDataCommand(client, userId, {
    operationId: randomUUID(),
    action,
    id,
    values,
  } as DataCommand)
  if (result.status !== "success") throw new Error("Not confirmed")
  return result.receipt.row as Tables<"scheduled_services">
}
function createScheduledService(client: SupabaseClient<Database>, userId: string, vehicleId: string, input: unknown) {
  return scheduleCommand(client, userId, "schedule.create", randomUUID(), {
    ...scheduledServiceSchema.parse(input),
    vehicle_id: vehicleId,
  })
}
async function updateScheduledService(client: SupabaseClient<Database>, userId: string, id: string, input: unknown) {
  return scheduleCommand(client, userId, "schedule.update", id, scheduledServiceSchema.parse(input))
}
function cancelScheduledService(client: SupabaseClient<Database>, userId: string, id: string) {
  return scheduleCommand(client, userId, "schedule.cancel", id, {})
}

let alice: Awaited<ReturnType<typeof createAccount>>
let vehicleId: string
beforeAll(async () => {
  prepareDatabase()
  alice = await createAccount("schedule-alice")
  const vehicle = await alice.client
    .from("vehicles")
    .insert({ user_id: alice.id, make: "Schedule", model: "Test", year: 2026, mileage: 0 })
    .select()
    .single()
  if (vehicle.error) throw vehicle.error
  vehicleId = vehicle.data.id
}, 60000)

test("schedule commands persist zero and NULL clears, reject empty criteria and report zero affected rows", async () => {
  const row = await createScheduledService(alice.client, alice.id, vehicleId, {
    type: "oil_change",
    scheduled_date: "2026-03-08",
    scheduled_mileage: "0",
    description: " detail ",
    notes: " note ",
  })
  expect(row).toMatchObject({
    scheduled_date: "2026-03-08",
    scheduled_mileage: 0,
    description: "detail",
    notes: "note",
  })
  const clearedDate = await updateScheduledService(alice.client, alice.id, row.id, {
    type: "oil_change",
    scheduled_date: "",
    scheduled_mileage: "0",
    description: "",
    notes: "",
  })
  expect(clearedDate).toMatchObject({ scheduled_date: null, scheduled_mileage: 0, description: null, notes: null })
  const clearedMileage = await updateScheduledService(alice.client, alice.id, row.id, {
    type: "oil_change",
    scheduled_date: "2026-03-08",
    scheduled_mileage: "",
  })
  expect(clearedMileage).toMatchObject({ scheduled_date: "2026-03-08", scheduled_mileage: null })
  await expect(updateScheduledService(alice.client, alice.id, row.id, { type: "oil_change" })).rejects.toThrow()
  await expect(cancelScheduledService(alice.client, alice.id, randomUUID())).rejects.toThrow()
  const bob = await createAccount("schedule-bob")
  await expect(cancelScheduledService(bob.client, bob.id, row.id)).rejects.toThrow()
  expect((await alice.client.from("scheduled_services").select("status").eq("id", row.id).single()).data?.status).toBe(
    "pending"
  )
  await cancelScheduledService(alice.client, alice.id, row.id)
  await expect(
    updateScheduledService(alice.client, alice.id, row.id, { type: "other", scheduled_mileage: 0 })
  ).rejects.toThrow()
  expect((await alice.client.from("scheduled_services").select("id").eq("status", "pending")).data).toEqual([])
})

test("current vehicle mileage drives reminders and explicit transactional completion retires only the selected forecast", async () => {
  const { selectScheduledServices } = await import("../../lib/data/scheduled-services")
  const forecast = await createScheduledService(alice.client, alice.id, vehicleId, {
    type: "oil_change",
    scheduled_mileage: 100,
  })
  const sameType = await createScheduledService(alice.client, alice.id, vehicleId, {
    type: "oil_change",
    scheduled_date: "2026-03-08",
  })
  const read = async () => {
    const result = await alice.client.from("scheduled_services").select("*,vehicles(mileage)").eq("status", "pending")
    expect(result.error).toBeNull()
    if (result.error || !result.data) throw new Error("Could not read pending forecasts")
    return result.data
  }
  expect(selectScheduledServices(await read(), "2026-03-08").map(({ service }) => service.id)).toEqual([sameType.id])
  const raised = await alice.client.from("vehicles").update({ mileage: 100 }).eq("id", vehicleId).select("id")
  expect(raised.error).toBeNull()
  expect(raised.data).toEqual([{ id: vehicleId }])
  expect(selectScheduledServices(await read(), "2026-03-08").map(({ service }) => service.id)).toEqual([
    forecast.id,
    sameType.id,
  ])
  const completed = await alice.client.rpc("create_maintenance_batch", {
    p_operation_id: randomUUID(),
    p_vehicle_id: vehicleId,
    p_today: "2026-03-08",
    p_batch: {
      service_date: "2026-03-07",
      mileage: 0,
      notes: null,
      services: [{ type: "other", description: null, cost: 0 }],
    },
    p_completion: { scheduled_service_id: forecast.id, service_index: 0 },
  })
  expect(completed.error).toBeNull()
  const receipt = completed.data
  expect(receipt.records[0]).toMatchObject({ service_date: "2026-03-07", mileage: 0, cost: 0, type: "other" })
  expect(receipt.scheduled_service).toMatchObject({
    id: forecast.id,
    status: "completed",
    completed_record_id: receipt.records[0].id,
  })
  expect(selectScheduledServices(await read(), "2026-03-08").map(({ service }) => service.id)).toEqual([sameType.id])
  await expect(cancelScheduledService(alice.client, alice.id, forecast.id)).rejects.toThrow()
  await cancelScheduledService(alice.client, alice.id, sameType.id)
  expect(await read()).toEqual([])
})
