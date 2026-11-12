import { describe, expect, it } from "vitest"
import {
  EDITOR_POLICY,
  confirmsDraft,
  editorFrozen,
  isEditorOpen,
  settledOperation,
  transitionEditor,
  type EditorEvent,
  type EditorState,
} from "@/lib/ui/editor-machine"
import type { PendingOperation } from "@/lib/data/operation-machine"
import type { PendingCommand } from "@/lib/data/pending-operations"

const STATES: Record<string, EditorState> = {
  closed: { status: "closed", error: null, operationId: null },
  "closed(error)": { status: "closed", error: "old", operationId: null },
  "closed(retained)": { status: "closed", error: "unknown copy", operationId: "op-1" },
  editing: { status: "editing", error: null },
  "editing(error)": { status: "editing", error: "old" },
  submitting: { status: "submitting" },
  unresolved: { status: "unresolved", error: "unknown copy", operationId: "op-1" },
}

const EVENTS: Record<string, EditorEvent> = {
  OPEN: { type: "OPEN" },
  CLOSE: { type: "CLOSE" },
  "SUBMIT(invalid)": { type: "SUBMIT", validationError: "invalid copy" },
  "SUBMIT(valid)": { type: "SUBMIT", validationError: null },
  "OUTCOME(confirmed)": { type: "OUTCOME", outcome: { status: "confirmed" }, message: null },
  "OUTCOME(rejected)": { type: "OUTCOME", outcome: { status: "rejected" }, message: "rejected copy" },
  "OUTCOME(blocked)": {
    type: "OUTCOME",
    outcome: { status: "blocked", reason: "conflict" },
    message: "blocked copy",
  },
  "OUTCOME(unknown)": {
    type: "OUTCOME",
    outcome: { status: "unknown", operationId: "op-2" },
    message: "unknown copy 2",
  },
  FAILED: { type: "FAILED", message: "failed copy" },
  "OPERATION_SETTLED(own)": { type: "OPERATION_SETTLED", operationId: "op-1", outcome: "confirmed", message: null },
  "OPERATION_SETTLED(other)": { type: "OPERATION_SETTLED", operationId: "op-9", outcome: "confirmed", message: null },
  "OPERATION_SETTLED(own, rejected)": {
    type: "OPERATION_SETTLED",
    operationId: "op-1",
    outcome: "rejected",
    message: "rejected copy",
  },
  "OPERATION_SETTLED(other, rejected)": {
    type: "OPERATION_SETTLED",
    operationId: "op-9",
    outcome: "rejected",
    message: "rejected copy",
  },
}

const CLOSED = STATES.closed
const editingWith = (error: string): EditorState => ({ status: "editing", error })

// Independent copy of the header table. Every pair not listed keeps its state.
const TABLE: Record<string, Record<string, EditorState>> = {
  closed: { OPEN: STATES.editing },
  "closed(error)": { OPEN: STATES["editing(error)"] },
  "closed(retained)": {
    OPEN: STATES.unresolved,
    "OPERATION_SETTLED(own)": CLOSED,
    // A rejected replay keeps the draft; reopening shows the rejection inline.
    "OPERATION_SETTLED(own, rejected)": { status: "closed", error: "rejected copy", operationId: null },
  },
  editing: {
    CLOSE: CLOSED,
    "SUBMIT(invalid)": editingWith("invalid copy"),
    "SUBMIT(valid)": STATES.submitting,
  },
  "editing(error)": {
    CLOSE: STATES["closed(error)"],
    "SUBMIT(invalid)": editingWith("invalid copy"),
    "SUBMIT(valid)": STATES.submitting,
  },
  submitting: {
    "OUTCOME(confirmed)": CLOSED,
    "OUTCOME(rejected)": editingWith("rejected copy"),
    "OUTCOME(blocked)": editingWith("blocked copy"),
    "OUTCOME(unknown)": { status: "unresolved", error: "unknown copy 2", operationId: "op-2" },
    FAILED: editingWith("failed copy"),
  },
  unresolved: {
    CLOSE: STATES["closed(retained)"],
    "SUBMIT(invalid)": editingWith("invalid copy"),
    "SUBMIT(valid)": STATES.submitting,
    "OPERATION_SETTLED(own)": CLOSED,
    // A rejected replay returns to editing like a rejected first send (D2).
    "OPERATION_SETTLED(own, rejected)": editingWith("rejected copy"),
  },
}

describe("editor dialog", () => {
  for (const [stateName, state] of Object.entries(STATES))
    for (const [eventName, event] of Object.entries(EVENTS)) {
      const expected = TABLE[stateName]?.[eventName] ?? state
      it(`${stateName} + ${eventName} -> ${expected.status}`, () => {
        expect(transitionEditor(state, event)).toEqual(expected)
      })
    }

  it("is open while editing, submitting or unresolved", () => {
    const open = Object.entries(STATES)
      .filter(([, state]) => isEditorOpen(state))
      .map(([name]) => name)
    expect(open).toEqual(["editing", "editing(error)", "submitting", "unresolved"])
  })

  it("resets the draft on a confirmed outcome and on a settle it accepts", () => {
    expect(confirmsDraft(STATES.submitting, EVENTS["OUTCOME(confirmed)"])).toBe(true)
    expect(confirmsDraft(STATES.submitting, EVENTS["OUTCOME(rejected)"])).toBe(false)
    expect(confirmsDraft(STATES.editing, EVENTS["OUTCOME(confirmed)"])).toBe(false)
    // D1: another operation settling never resets this editor's draft.
    expect(confirmsDraft(STATES.closed, EVENTS["OPERATION_SETTLED(other)"])).toBe(false)
    expect(confirmsDraft(STATES.editing, EVENTS["OPERATION_SETTLED(other)"])).toBe(false)
    expect(confirmsDraft(STATES.submitting, EVENTS["OPERATION_SETTLED(own)"])).toBe(false)
    expect(confirmsDraft(STATES.unresolved, EVENTS["OPERATION_SETTLED(own)"])).toBe(true)
    expect(confirmsDraft(STATES["closed(retained)"], EVENTS["OPERATION_SETTLED(own)"])).toBe(true)
    expect(confirmsDraft(STATES.unresolved, EVENTS["OPERATION_SETTLED(other)"])).toBe(false)
    // A rejected replay never resets the draft.
    expect(confirmsDraft(STATES.unresolved, EVENTS["OPERATION_SETTLED(own, rejected)"])).toBe(false)
    expect(confirmsDraft(STATES["closed(retained)"], EVENTS["OPERATION_SETTLED(own, rejected)"])).toBe(false)
  })
})

const operation = (action: PendingCommand["action"], operationId = "op-9"): PendingOperation => ({
  command: { action, operationId } as PendingCommand,
  status: "unknown",
})

describe("editor policy", () => {
  it("scopes the CRUD freeze and settle to the editor's own operation (D1)", () => {
    expect(EDITOR_POLICY.crud).toEqual({ freezeOn: "own-operation", closeWhenOwnSettled: true })
    expect(EDITOR_POLICY.batch).toEqual({ freezeOn: "batch-operation", closeWhenOwnSettled: false })
  })

  it("freezes a CRUD editor only while its own operation is pending", () => {
    expect(editorFrozen("crud", STATES.editing, [])).toBe(false)
    expect(editorFrozen("crud", STATES.editing, [operation("vehicle.update")])).toBe(false)
    expect(editorFrozen("crud", STATES.editing, [operation("maintenance.batch")])).toBe(false)
    expect(editorFrozen("crud", STATES.unresolved, [operation("vehicle.update")])).toBe(false)
    expect(editorFrozen("crud", STATES.unresolved, [operation("vehicle.update", "op-1")])).toBe(true)
    expect(editorFrozen("crud", STATES["closed(retained)"], [operation("vehicle.update", "op-1")])).toBe(true)
  })

  it("freezes the batch editor on any pending batch, which it adopts", () => {
    expect(editorFrozen("batch", STATES.editing, [operation("vehicle.update")])).toBe(false)
    expect(editorFrozen("batch", STATES.editing, [operation("maintenance.batch")])).toBe(true)
  })

  it("reports the editor's own operation and how it settled once it leaves the pending list", () => {
    const confirmed = { operationId: "op-1", outcome: "confirmed" }
    expect(settledOperation(STATES.unresolved, [operation("vehicle.update", "op-1")], [])).toBeNull()
    expect(settledOperation(STATES.unresolved, [operation("vehicle.update")], [])).toEqual(confirmed)
    expect(settledOperation(STATES["closed(retained)"], [], [])).toEqual(confirmed)
    expect(settledOperation(STATES.unresolved, [], ["op-9"])).toEqual(confirmed)
    expect(settledOperation(STATES.unresolved, [], ["op-1"])).toEqual({ operationId: "op-1", outcome: "rejected" })
    expect(settledOperation(STATES.editing, [], [])).toBeNull()
    expect(settledOperation(STATES.closed, [], [])).toBeNull()
    expect(settledOperation(STATES.submitting, [], [])).toBeNull()
  })
})
