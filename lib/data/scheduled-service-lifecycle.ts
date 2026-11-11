// Scheduled service lifecycle (machine 9). The database enforces it; this table names it.
//
// | from        | event              | to          | enforced by                                        |
// | ----------- | ------------------ | ----------- | -------------------------------------------------- |
// | —           | CREATE             | pending     | `mutate_data` `schedule.create` (scripts/008)      |
// | pending     | UPDATE             | pending     | `mutate_data` `schedule.update`, status='pending'  |
// | pending     | COMPLETE           | completed   | `create_maintenance_batch` completion (scripts/007)|
// |             |                    |             | guard: service day ≤ today (scripts/007:131)       |
// | pending     | CANCEL             | cancelled   | `mutate_data` `schedule.cancel`, status='pending'  |
// | completed   | COMPLETION_DELETED | pending     | trigger `clear_deleted_completion` (scripts/007)   |
// | cancelled   | —                  | terminal    | no statement matches                               |
//
// Invariant (CHECK `scheduled_completion_state`): status = 'completed' ⇔ completed_record_id IS NOT NULL.
// tests/data-api/scheduled-service-lifecycle.test.ts walks every pair against the real SQL functions.

export const SCHEDULED_SERVICE_STATUS = ["pending", "completed", "cancelled"] as const
export type ScheduledServiceStatus = (typeof SCHEDULED_SERVICE_STATUS)[number]

export const SCHEDULED_SERVICE_EVENT = ["CREATE", "UPDATE", "COMPLETE", "CANCEL", "COMPLETION_DELETED"] as const
export type ScheduledServiceEvent = (typeof SCHEDULED_SERVICE_EVENT)[number]

export const SCHEDULED_SERVICE_TRANSITIONS = [
  { from: null, event: "CREATE", to: "pending" },
  { from: "pending", event: "UPDATE", to: "pending" },
  { from: "pending", event: "COMPLETE", to: "completed" },
  { from: "pending", event: "CANCEL", to: "cancelled" },
  { from: "completed", event: "COMPLETION_DELETED", to: "pending" },
] as const satisfies readonly {
  from: ScheduledServiceStatus | null
  event: ScheduledServiceEvent
  to: ScheduledServiceStatus
}[]

/** `from` is `null` before the service exists. */
export function canTransition(from: ScheduledServiceStatus | null, event: ScheduledServiceEvent): boolean {
  return SCHEDULED_SERVICE_TRANSITIONS.some((row) => row.from === from && row.event === event)
}

/** Only a pending service is open: it can be edited, completed, cancelled or shown as a reminder. */
export const PENDING_SCHEDULED_SERVICE = "pending" satisfies ScheduledServiceStatus

export function isPendingScheduledService(status: ScheduledServiceStatus): status is "pending" {
  return status === PENDING_SCHEDULED_SERVICE
}
