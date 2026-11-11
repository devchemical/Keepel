// Machine 6 — Editor dialog. Owner: hooks/use-editor.ts (the only place with effects).
//
// | from                    | event                            | to                                          |
// | ----------------------- | -------------------------------- | ------------------------------------------- |
// | closed                  | OPEN                             | editing, or unresolved if it kept an op     |
// | closed (kept op)        | OPERATION_SETTLED (its own id)   | closed, op and error dropped, draft reset   |
// | editing, unresolved     | SUBMIT (validationError)         | editing with `error`                        |
// | editing, unresolved     | SUBMIT (no validationError)      | submitting                                  |
// | submitting              | OUTCOME confirmed                | closed (draft reset for create editors)     |
// | submitting              | OUTCOME rejected, blocked/FAILED | editing with `error`                        |
// | submitting              | OUTCOME unknown                  | unresolved with `operationId`               |
// | unresolved              | OPERATION_SETTLED (its own id)   | closed (draft reset)                        |
// | editing, unresolved     | CLOSE                            | closed (error and operation retained)       |
//
// Every other pair keeps its state; in particular `submitting` ignores CLOSE (every editor blocks
// close while submitting, D3) and SUBMIT (single flight), and OPERATION_SETTLED for another
// operation never closes or resets an editor (D1). Whether pending operations freeze the fields is
// decided by `EDITOR_POLICY` outside the machine: a CRUD editor only by its own operation, so an
// unrelated editor stays usable and the data owner's `conflictsWith` is the only app-wide guard.
// SUBMIT from `unresolved` is the batch editor's check/replay of its own operation; CRUD editors
// are frozen while it is pending. After a reload the association is gone and recovery continues
// through the OperationRecovery panel.
//
// Machine 7 (the app-wide unresolved-editor latch) was removed by D1.
// Machine 8 (row action selection) lives in lib/ui/row-action.ts.

import type { OperationKind, OperationOutcome, PendingOperation } from "@/lib/data/operation-machine"

export const EDITOR_STATUS = ["closed", "editing", "submitting", "unresolved"] as const
export type EditorStatus = (typeof EDITOR_STATUS)[number]

export type EditorState =
  | { status: "closed"; error: string | null; operationId: string | null }
  | { status: "editing"; error: string | null }
  | { status: "submitting" }
  | { status: "unresolved"; error: string | null; operationId: string }

export type EditorEvent =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  /** `validationError` is the copy for a draft that failed validation, or `null` to send it. */
  | { type: "SUBMIT"; validationError: string | null }
  | { type: "OUTCOME"; outcome: OperationOutcome; message: string | null }
  | { type: "FAILED"; message: string }
  | { type: "OPERATION_SETTLED"; operationId: string }

export const EDITOR_CLOSED: EditorState = { status: "closed", error: null, operationId: null }
export const EDITOR_EDITING: EditorState = { status: "editing", error: null }

function stateAfterSubmit(event: EditorEvent & { type: "SUBMIT" }): EditorState {
  return event.validationError === null ? { status: "submitting" } : { status: "editing", error: event.validationError }
}

function stateAfterSubmission(event: EditorEvent & { type: "OUTCOME" | "FAILED" }): EditorState {
  if (event.type === "FAILED") return { status: "editing", error: event.message }
  switch (event.outcome.status) {
    case "confirmed":
      return EDITOR_CLOSED
    case "unknown":
      return { status: "unresolved", error: event.message, operationId: event.outcome.operationId }
    default:
      return { status: "editing", error: event.message }
  }
}

export function transitionEditor(state: EditorState, event: EditorEvent): EditorState {
  switch (state.status) {
    case "closed":
      if (event.type === "OPEN")
        return state.operationId === null
          ? { status: "editing", error: state.error }
          : { status: "unresolved", error: state.error, operationId: state.operationId }
      if (event.type === "OPERATION_SETTLED" && event.operationId === state.operationId) return EDITOR_CLOSED
      return state
    case "editing":
      if (event.type === "SUBMIT") return stateAfterSubmit(event)
      if (event.type === "CLOSE") return { status: "closed", error: state.error, operationId: null }
      return state
    case "submitting":
      if (event.type === "OUTCOME" || event.type === "FAILED") return stateAfterSubmission(event)
      return state
    case "unresolved":
      if (event.type === "SUBMIT") return stateAfterSubmit(event)
      if (event.type === "CLOSE") return { status: "closed", error: state.error, operationId: state.operationId }
      if (event.type === "OPERATION_SETTLED" && event.operationId === state.operationId) return EDITOR_CLOSED
      return state
    default:
      return state satisfies never
  }
}

export function isEditorOpen(state: EditorState): boolean {
  return state.status !== "closed"
}

/** Whether `event` confirms the editor's write, so a create editor must reset its draft. */
export function confirmsDraft(state: EditorState, event: EditorEvent): boolean {
  switch (event.type) {
    case "OUTCOME":
      return state.status === "submitting" && event.outcome.status === "confirmed"
    case "OPERATION_SETTLED":
      return (state.status === "closed" || state.status === "unresolved") && state.operationId === event.operationId
    default:
      return false
  }
}

/** Editors are split by the kind of operation they write. */
export type EditorKind = OperationKind

/**
 * The split between the CRUD editors and the maintenance batch editor. D3 made every editor block
 * close while submitting; D1 scoped the CRUD freeze and settle to the editor's own operation. The
 * batch editor adopts the single pending batch, so any pending batch freezes it.
 */
export const EDITOR_POLICY = {
  crud: { freezeOn: "own-operation", closeWhenOwnSettled: true },
  batch: { freezeOn: "batch-operation", closeWhenOwnSettled: false },
} as const satisfies Record<EditorKind, { freezeOn: "own-operation" | "batch-operation"; closeWhenOwnSettled: boolean }>

/** The operation this editor submitted and still waits on, if any. */
function ownOperationId(state: EditorState): string | null {
  return state.status === "closed" || state.status === "unresolved" ? state.operationId : null
}

/** Whether pending operations freeze the editor's fields. */
export function editorFrozen(
  kind: EditorKind,
  state: EditorState,
  pendingOperations: readonly PendingOperation[]
): boolean {
  if (EDITOR_POLICY[kind].freezeOn === "batch-operation")
    return pendingOperations.some((operation) => operation.command.action === "maintenance.batch")
  const own = ownOperationId(state)
  return own !== null && pendingOperations.some((operation) => operation.command.operationId === own)
}

/** The editor's own operation once it has left the owner's pending list, or `null`. */
export function settledOperation(state: EditorState, pendingOperations: readonly PendingOperation[]): string | null {
  const own = ownOperationId(state)
  if (own === null || pendingOperations.some((operation) => operation.command.operationId === own)) return null
  return own
}
