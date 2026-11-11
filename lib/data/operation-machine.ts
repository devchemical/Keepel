// Machine 1 — Data operation lifecycle. Owner: contexts/DataContext.tsx (the only place with effects).
//
// | from     | event              | to        | guard / note                                        |
// | -------- | ------------------ | --------- | --------------------------------------------------- |
// | —        | SUBMIT             | sending   | no conflict (`conflictsWith`), journal allows it    |
// | sending  | RECEIPT            | confirmed | receipt matches operation, action, id and account   |
// | sending  | REJECTED           | rejected  | native database error only                          |
// | sending  | NO_PROOF           | unknown   | timeout, transport, malformed or missing receipt    |
// | sending  | RESTORED           | unknown   | reload of the same account's journal                |
// | unknown  | CHECK              | checking  | user query, or automatic once if policy says so     |
// | unknown  | REPLAY             | sending   | `replayable` policy only; same frozen command       |
// | checking | RECEIPT            | confirmed |                                                     |
// | checking | NO_PROOF           | unknown   | a missing receipt never proves rollback             |
// | checking | RESTORED           | unknown   |                                                     |
//
// Every other pair keeps its state. `confirmed` and `rejected` are terminal: the owner removes the
// operation from its pending list and its journal. A session change drops the operation from memory
// but keeps it in the account's journal; that is not a status transition.
//
// Machine 2 — Operation journal health (per-tab sessionStorage journal, same owner).
//
// | from       | event          | to         | note                                         |
// | ---------- | -------------- | ---------- | -------------------------------------------- |
// | any        | RESTORED       | healthy    | the account's journal was read on mount      |
// | any        | RESTORE_FAILED | unreadable | blocks every submit until the next restore   |
// | healthy    | WRITTEN        | healthy    |                                              |
// | unwritable | WRITTEN        | healthy    |                                              |
// | healthy    | WRITE_FAILED   | unwritable | blocks kinds that require a durable journal  |
// | unwritable | WRITE_FAILED   | unwritable |                                              |
// | unreadable | WRITTEN        | unreadable | nothing is written while unreadable          |
// | unreadable | WRITE_FAILED   | unreadable |                                              |

import type { PendingCommand } from "./pending-operations"

export const OPERATION_STATUS = ["sending", "unknown", "checking", "confirmed", "rejected"] as const
export type OperationStatus = (typeof OPERATION_STATUS)[number]
/** Statuses an operation can hold while it is still in the owner's pending list. */
export type PendingOperationStatus = Exclude<OperationStatus, "confirmed" | "rejected">

export type OperationEvent =
  | { type: "RECEIPT" }
  | { type: "REJECTED" }
  | { type: "NO_PROOF" }
  | { type: "CHECK" }
  | { type: "REPLAY"; replayable: boolean }
  | { type: "RESTORED" }

export function transitionOperation(status: OperationStatus, event: OperationEvent): OperationStatus {
  switch (status) {
    case "sending":
      if (event.type === "RECEIPT") return "confirmed"
      if (event.type === "REJECTED") return "rejected"
      if (event.type === "NO_PROOF" || event.type === "RESTORED") return "unknown"
      return status
    case "unknown":
      if (event.type === "CHECK") return "checking"
      if (event.type === "REPLAY" && event.replayable) return "sending"
      return status
    case "checking":
      if (event.type === "RECEIPT") return "confirmed"
      if (event.type === "NO_PROOF" || event.type === "RESTORED") return "unknown"
      return status
    case "confirmed":
    case "rejected":
      return status
    default:
      return status satisfies never
  }
}

export function isTerminalStatus(status: OperationStatus): status is "confirmed" | "rejected" {
  return status === "confirmed" || status === "rejected"
}

export type PendingOperation = { command: PendingCommand; status: PendingOperationStatus }

export const JOURNAL_HEALTH = ["healthy", "unwritable", "unreadable"] as const
export type JournalHealth = (typeof JOURNAL_HEALTH)[number]
export type JournalEvent =
  | { type: "RESTORED" }
  | { type: "RESTORE_FAILED" }
  | { type: "WRITTEN" }
  | { type: "WRITE_FAILED" }

export function transitionJournal(health: JournalHealth, event: JournalEvent): JournalHealth {
  if (event.type === "RESTORED") return "healthy"
  if (event.type === "RESTORE_FAILED") return "unreadable"
  switch (health) {
    case "healthy":
    case "unwritable":
      return event.type === "WRITTEN" ? "healthy" : "unwritable"
    case "unreadable":
      return health
    default:
      return health satisfies never
  }
}

export type OperationKind = "crud" | "batch"

export function operationKind(action: PendingCommand["action"]): OperationKind {
  return action === "maintenance.batch" ? "batch" : "crud"
}

/**
 * Deliberate differences between `mutate_data` commands and `create_maintenance_batch`
 * (docs/testing/data-owner.md). A policy change is a decision, not an edit to the owner.
 */
export const OPERATION_POLICY = {
  crud: { requiresDurableJournal: false, autoCheckAfterNoProof: false, replayable: false },
  batch: { requiresDurableJournal: true, autoCheckAfterNoProof: true, replayable: true },
} as const satisfies Record<
  OperationKind,
  { requiresDurableJournal: boolean; autoCheckAfterNoProof: boolean; replayable: boolean }
>

export type OperationCandidate = { action: PendingCommand["action"]; operationId: string; id?: string }

/**
 * Whether `pending` prevents submitting `candidate`. A CRUD command conflicts with any pending
 * command on the same resource, and with another pending create of the same kind. A batch
 * conflicts with any pending batch except an explicit replay of that same unresolved operation.
 */
export function conflictsWith(pending: PendingOperation, candidate: OperationCandidate): boolean {
  if (candidate.action === "maintenance.batch") {
    if (pending.command.action !== "maintenance.batch") return false
    return pending.command.operationId !== candidate.operationId || pending.status !== "unknown"
  }
  return (
    ("id" in pending.command && pending.command.id === candidate.id) ||
    (pending.command.action === candidate.action && candidate.action.endsWith(".create"))
  )
}

export const BLOCK_REASON = [
  "conflict",
  "journal-unreadable",
  "journal-unwritable",
  "no-session",
  "session-changed",
] as const
export type BlockReason = (typeof BLOCK_REASON)[number]

/** The single result of every DataContext mutation. Outcomes are values, never thrown. */
export type OperationOutcome =
  | { status: "confirmed" }
  | { status: "rejected" }
  | { status: "unknown"; operationId: string }
  | { status: "blocked"; reason: BlockReason }
