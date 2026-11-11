// Machine 6 — Editor dialog. Owner: hooks/use-editor.ts (the only place with effects).
//
// | from                    | event                            | to                                          |
// | ----------------------- | -------------------------------- | ------------------------------------------- |
// | closed                  | OPEN                             | editing, or unresolved if it kept an op     |
// | closed (kept op)        | OPERATION_SETTLED (its own id)   | closed, op and error dropped, draft reset   |
// | closed                  | ALL_SETTLED                      | closed, op and error dropped, draft reset   |
// | editing, unresolved     | SUBMIT (invalid)                 | editing with `error`                        |
// | editing, unresolved     | SUBMIT (valid)                   | submitting                                  |
// | submitting              | OUTCOME confirmed                | closed (draft reset for create editors)     |
// | submitting              | OUTCOME rejected, blocked/FAILED | editing with `error` (closed if hidden)     |
// | submitting              | OUTCOME unknown                  | unresolved with `operationId` (closed, kept |
// |                         |                                  | op, if hidden)                              |
// | submitting (hidden)     | OPEN                             | submitting, visible again                   |
// | unresolved              | OPERATION_SETTLED (its own id)   | closed (draft reset)                        |
// | editing, unresolved     | ALL_SETTLED                      | closed (draft reset)                        |
// | editing, unresolved     | CLOSE                            | closed (error and operation retained)       |
// | submitting              | CLOSE (whileSubmitting: ignore)  | submitting (ignored)                        |
// | submitting              | CLOSE (whileSubmitting: hide)    | submitting, hidden until the outcome lands  |
//
// Every other pair keeps its state; in particular `submitting` ignores SUBMIT (single flight) and
// ALL_SETTLED. Whether an editor may submit while operations are pending is a freeze decided by
// `EDITOR_POLICY` outside the machine. SUBMIT from `unresolved` is the batch editor's check/replay of
// its own operation; CRUD editors are frozen while it is pending.
//
// Machine 7 — Unresolved-editor latch (today's app-wide close after every pending operation settles).
//
// | from  | event                                | to    | note                              |
// | ----- | ------------------------------------ | ----- | --------------------------------- |
// | idle  | PENDING_CHANGED (some unknown)       | armed |                                   |
// | armed | PENDING_CHANGED (none pending)       | idle  | the owner dispatches ALL_SETTLED  |
//
// Machine 8 (row action selection) lives in lib/ui/row-action.ts.

import type { OperationOutcome, PendingOperation } from "@/lib/data/operation-machine"

export const EDITOR_STATUS = ["closed", "editing", "submitting", "unresolved"] as const
export type EditorStatus = (typeof EDITOR_STATUS)[number]

export type EditorState =
  | { status: "closed"; error: string | null; operationId: string | null }
  | { status: "editing"; error: string | null }
  | { status: "submitting"; hidden: boolean }
  | { status: "unresolved"; error: string | null; operationId: string }

export type EditorEvent =
  | { type: "OPEN" }
  | { type: "CLOSE"; whileSubmitting: "ignore" | "hide" }
  | { type: "SUBMIT"; invalid: string | null }
  | { type: "OUTCOME"; outcome: OperationOutcome; message: string | null }
  | { type: "FAILED"; message: string }
  | { type: "OPERATION_SETTLED"; operationId: string }
  | { type: "ALL_SETTLED" }

export const EDITOR_CLOSED: EditorState = { status: "closed", error: null, operationId: null }
export const EDITOR_EDITING: EditorState = { status: "editing", error: null }

function submitted(event: EditorEvent & { type: "SUBMIT" }): EditorState {
  return event.invalid === null ? { status: "submitting", hidden: false } : { status: "editing", error: event.invalid }
}

function landed(hidden: boolean, event: EditorEvent & { type: "OUTCOME" | "FAILED" }): EditorState {
  if (event.type === "OUTCOME" && event.outcome.status === "confirmed") return EDITOR_CLOSED
  const error = event.message
  if (event.type === "OUTCOME" && event.outcome.status === "unknown") {
    const { operationId } = event.outcome
    return hidden ? { status: "closed", error, operationId } : { status: "unresolved", error, operationId }
  }
  return hidden ? { status: "closed", error, operationId: null } : { status: "editing", error }
}

export function transitionEditor(state: EditorState, event: EditorEvent): EditorState {
  switch (state.status) {
    case "closed":
      if (event.type === "OPEN")
        return state.operationId === null
          ? { status: "editing", error: state.error }
          : { status: "unresolved", error: state.error, operationId: state.operationId }
      if (event.type === "ALL_SETTLED") return EDITOR_CLOSED
      if (event.type === "OPERATION_SETTLED" && event.operationId === state.operationId) return EDITOR_CLOSED
      return state
    case "editing":
      if (event.type === "SUBMIT") return submitted(event)
      if (event.type === "CLOSE") return { status: "closed", error: state.error, operationId: null }
      if (event.type === "ALL_SETTLED") return EDITOR_CLOSED
      return state
    case "submitting":
      if (event.type === "OUTCOME" || event.type === "FAILED") return landed(state.hidden, event)
      if (event.type === "CLOSE" && event.whileSubmitting === "hide" && !state.hidden)
        return { status: "submitting", hidden: true }
      if (event.type === "OPEN" && state.hidden) return { status: "submitting", hidden: false }
      return state
    case "unresolved":
      if (event.type === "SUBMIT") return submitted(event)
      if (event.type === "CLOSE") return { status: "closed", error: state.error, operationId: state.operationId }
      if (event.type === "ALL_SETTLED") return EDITOR_CLOSED
      if (event.type === "OPERATION_SETTLED" && event.operationId === state.operationId) return EDITOR_CLOSED
      return state
    default:
      return state satisfies never
  }
}

export function isEditorOpen(state: EditorState): boolean {
  return state.status === "editing" || state.status === "unresolved" || (state.status === "submitting" && !state.hidden)
}

/** Whether `event` confirms the editor's write, so a create editor must reset its draft. */
export function confirmsDraft(state: EditorState, event: EditorEvent): boolean {
  switch (event.type) {
    case "OUTCOME":
      return state.status === "submitting" && event.outcome.status === "confirmed"
    case "ALL_SETTLED":
      return state.status !== "submitting"
    case "OPERATION_SETTLED":
      return (state.status === "closed" || state.status === "unresolved") && state.operationId === event.operationId
    default:
      return false
  }
}

export const SETTLE_LATCH = ["idle", "armed"] as const
export type SettleLatch = (typeof SETTLE_LATCH)[number]
export type SettleLatchEvent = { type: "PENDING_CHANGED"; pending: number; anyUnknown: boolean }

export function transitionSettleLatch(latch: SettleLatch, event: SettleLatchEvent): SettleLatch {
  switch (latch) {
    case "idle":
      return event.anyUnknown ? "armed" : latch
    case "armed":
      return event.pending === 0 ? "idle" : latch
    default:
      return latch satisfies never
  }
}

export type EditorKind = "crud" | "batch"

/**
 * The split between the CRUD editors and the maintenance batch editor. D3 made every editor block
 * close while submitting; D1 (docs/specs/explicit-state-machines.md) changes the freeze, not the machine.
 */
export const EDITOR_POLICY = {
  crud: { closeWhileSubmitting: "ignore", freezeOn: "any-operation", closeWhenAllSettled: true },
  batch: { closeWhileSubmitting: "ignore", freezeOn: "batch-operation", closeWhenAllSettled: false },
} as const satisfies Record<
  EditorKind,
  {
    closeWhileSubmitting: "ignore" | "hide"
    freezeOn: "any-operation" | "batch-operation"
    closeWhenAllSettled: boolean
  }
>

/** Whether pending operations freeze the editor's fields. */
export function editorFrozen(kind: EditorKind, pendingOperations: readonly PendingOperation[]): boolean {
  return EDITOR_POLICY[kind].freezeOn === "any-operation"
    ? pendingOperations.length > 0
    : pendingOperations.some((operation) => operation.command.action === "maintenance.batch")
}
