import { randomUUID } from "node:crypto"
import { beforeAll, expect, test } from "vitest"
import {
  SCHEDULED_SERVICE_EVENT,
  SCHEDULED_SERVICE_STATUS,
  SCHEDULED_SERVICE_TRANSITIONS,
  canTransition,
  type ScheduledServiceEvent,
  type ScheduledServiceStatus,
} from "../../lib/data/scheduled-service-lifecycle"
import { createAccount, prepareDatabase } from "./support"

// Walks every (status, event) pair of the TypeScript lifecycle table against the real SQL functions,
// so the table cannot drift from scripts/007 and scripts/008 silently.

const TODAY = "2026-03-08"
let alice: Awaited<ReturnType<typeof createAccount>>
let vehicleId: string
beforeAll(async () => {
  prepareDatabase()
  alice = await createAccount("lifecycle")
  const vehicle = await alice.client
    .from("vehicles")
    .insert({ user_id: alice.id, make: "Lifecycle", model: "Table", year: 2026, mileage: 0 })
    .select()
    .single()
  if (vehicle.error) throw vehicle.error
  vehicleId = vehicle.data.id
}, 60000)

const values = {
  type: "oil_change",
  scheduled_date: "2026-04-01",
  scheduled_mileage: null,
  description: null,
  notes: null,
}

function mutate(action: string, id: string, payload: Record<string, unknown> = {}) {
  return alice.client.rpc("mutate_data", {
    p_operation_id: randomUUID(),
    p_action: action,
    p_id: id,
    p_values: payload,
  })
}

function batch(completion: { scheduled_service_id: string; service_index: number } | null) {
  return alice.client.rpc("create_maintenance_batch", {
    p_operation_id: randomUUID(),
    p_vehicle_id: vehicleId,
    p_today: TODAY,
    p_batch: {
      service_date: TODAY,
      mileage: null,
      notes: null,
      services: [{ type: "other", description: null, cost: 0 }],
    },
    p_completion: completion,
  })
}

async function readStatus(id: string): Promise<ScheduledServiceStatus | null> {
  const result = await alice.client.from("scheduled_services").select("status,completed_record_id").eq("id", id)
  expect(result.error).toBeNull()
  const row = result.data?.[0]
  if (!row) return null
  // Invariant (CHECK scheduled_completion_state): completed ⇔ a linked maintenance record.
  expect(row.status === "completed").toBe(row.completed_record_id !== null)
  return row.status as ScheduledServiceStatus
}

/** Reaches `from` only through allowed transitions; returns the completion record when completed. */
async function arrange(from: ScheduledServiceStatus | null) {
  const id = randomUUID()
  if (from === null) return { id, completionRecord: null }
  expect((await mutate("schedule.create", id, { ...values, vehicle_id: vehicleId })).error).toBeNull()
  let completionRecord: string | null = null
  if (from === "completed") {
    const completed = await batch({ scheduled_service_id: id, service_index: 0 })
    expect(completed.error).toBeNull()
    completionRecord = completed.data.records[0].id as string
  }
  if (from === "cancelled") expect((await mutate("schedule.cancel", id)).error).toBeNull()
  expect(await readStatus(id)).toBe(from)
  return { id, completionRecord }
}

/** Sends the real statement for an event; returns whether the database accepted it. */
async function apply(event: ScheduledServiceEvent, id: string, completionRecord: string | null) {
  switch (event) {
    case "CREATE":
      return (await mutate("schedule.create", id, { ...values, vehicle_id: vehicleId })).error === null
    case "UPDATE":
      return (await mutate("schedule.update", id, { ...values, notes: "edited" })).error === null
    case "COMPLETE":
      return (await batch({ scheduled_service_id: id, service_index: 0 })).error === null
    case "CANCEL":
      return (await mutate("schedule.cancel", id)).error === null
    case "COMPLETION_DELETED": {
      // Without a linked completion, delete an unrelated record of the same vehicle instead.
      let recordId = completionRecord
      if (recordId === null) {
        const unrelated = await batch(null)
        expect(unrelated.error).toBeNull()
        recordId = unrelated.data.records[0].id as string
      }
      expect((await mutate("maintenance.delete", recordId)).error).toBeNull()
      return completionRecord !== null
    }
    default:
      return event satisfies never
  }
}

const pairs = [null, ...SCHEDULED_SERVICE_STATUS].flatMap((from) =>
  SCHEDULED_SERVICE_EVENT.map((event) => [from, event] as const)
)

test.each(pairs)("%s + %s follows the lifecycle table", async (from, event) => {
  const { id, completionRecord } = await arrange(from)
  const allowed = canTransition(from, event)
  const accepted = await apply(event, id, completionRecord)
  const to = SCHEDULED_SERVICE_TRANSITIONS.find((row) => row.from === from && row.event === event)?.to
  expect(accepted).toBe(allowed)
  expect(await readStatus(id)).toBe(allowed ? to : from)
})
