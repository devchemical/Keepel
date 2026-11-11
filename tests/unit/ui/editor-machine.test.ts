import { describe, expect, it } from "vitest"
import {
  EDITOR_POLICY,
  SETTLE_LATCH,
  confirmsDraft,
  editorFrozen,
  isEditorOpen,
  transitionEditor,
  transitionSettleLatch,
  type EditorEvent,
  type EditorState,
  type SettleLatch,
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
  "OPERATION_SETTLED(own)": { type: "OPERATION_SETTLED", operationId: "op-1" },
  "OPERATION_SETTLED(other)": { type: "OPERATION_SETTLED", operationId: "op-9" },
  ALL_SETTLED: { type: "ALL_SETTLED" },
}

const CLOSED = STATES.closed
const editingWith = (error: string): EditorState => ({ status: "editing", error })

// Independent copy of the header table. Every pair not listed keeps its state.
const TABLE: Record<string, Record<string, EditorState>> = {
  closed: { OPEN: STATES.editing, ALL_SETTLED: CLOSED },
  "closed(error)": { OPEN: STATES["editing(error)"], ALL_SETTLED: CLOSED },
  "closed(retained)": {
    OPEN: STATES.unresolved,
    "OPERATION_SETTLED(own)": CLOSED,
    ALL_SETTLED: CLOSED,
  },
  editing: {
    CLOSE: CLOSED,
    "SUBMIT(invalid)": editingWith("invalid copy"),
    "SUBMIT(valid)": STATES.submitting,
    ALL_SETTLED: CLOSED,
  },
  "editing(error)": {
    CLOSE: STATES["closed(error)"],
    "SUBMIT(invalid)": editingWith("invalid copy"),
    "SUBMIT(valid)": STATES.submitting,
    ALL_SETTLED: CLOSED,
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
    ALL_SETTLED: CLOSED,
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
    // Today's app-wide latch resets every mounted editor, even a closed one (D1 changes this).
    expect(confirmsDraft(STATES.closed, EVENTS.ALL_SETTLED)).toBe(true)
    expect(confirmsDraft(STATES.editing, EVENTS.ALL_SETTLED)).toBe(true)
    expect(confirmsDraft(STATES.submitting, EVENTS.ALL_SETTLED)).toBe(false)
    expect(confirmsDraft(STATES.unresolved, EVENTS["OPERATION_SETTLED(own)"])).toBe(true)
    expect(confirmsDraft(STATES["closed(retained)"], EVENTS["OPERATION_SETTLED(own)"])).toBe(true)
    expect(confirmsDraft(STATES.unresolved, EVENTS["OPERATION_SETTLED(other)"])).toBe(false)
  })
})

describe("unresolved-editor latch", () => {
  const SNAPSHOTS = {
    empty: { pending: 0, anyUnknown: false },
    sending: { pending: 1, anyUnknown: false },
    unknown: { pending: 1, anyUnknown: true },
  } as const
  const LATCH_TABLE: Record<SettleLatch, Record<keyof typeof SNAPSHOTS, SettleLatch>> = {
    idle: { empty: "idle", sending: "idle", unknown: "armed" },
    armed: { empty: "idle", sending: "armed", unknown: "armed" },
  }
  for (const latch of SETTLE_LATCH)
    for (const name of Object.keys(SNAPSHOTS) as (keyof typeof SNAPSHOTS)[])
      it(`${latch} + PENDING_CHANGED(${name}) -> ${LATCH_TABLE[latch][name]}`, () => {
        expect(transitionSettleLatch(latch, { type: "PENDING_CHANGED", ...SNAPSHOTS[name] })).toBe(
          LATCH_TABLE[latch][name]
        )
      })
})

const operation = (action: PendingCommand["action"]): PendingOperation => ({
  command: { action, operationId: "op" } as PendingCommand,
  status: "unknown",
})

describe("editor policy", () => {
  it("blocks close while submitting in every editor; only CRUD editors freeze app-wide (D3)", () => {
    expect(EDITOR_POLICY.crud).toEqual({
      freezeOn: "any-operation",
      closeWhenAllSettled: true,
    })
    expect(EDITOR_POLICY.batch).toEqual({
      freezeOn: "batch-operation",
      closeWhenAllSettled: false,
    })
  })

  it("freezes CRUD editors on any pending operation and the batch editor only on a batch", () => {
    expect(editorFrozen("crud", [])).toBe(false)
    expect(editorFrozen("crud", [operation("vehicle.update")])).toBe(true)
    expect(editorFrozen("crud", [operation("maintenance.batch")])).toBe(true)
    expect(editorFrozen("batch", [operation("vehicle.update")])).toBe(false)
    expect(editorFrozen("batch", [operation("maintenance.batch")])).toBe(true)
  })
})
