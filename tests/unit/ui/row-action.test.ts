import { describe, expect, it } from "vitest"
import { NO_ROW_ACTION, transitionRowAction, type RowAction, type RowActionEvent } from "@/lib/ui/row-action"

type Row = { id: string }
const a: Row = { id: "a" }
const b: Row = { id: "b" }

const STATES: Record<string, RowAction<Row>> = {
  none: { status: "none" },
  editing: { status: "editing", row: a },
  deleting: { status: "deleting", row: a },
  completing: { status: "completing", row: a },
}

const EVENTS: Record<string, RowActionEvent<Row>> = {
  "SELECT editing": { type: "SELECT", action: "editing", row: b },
  "SELECT deleting": { type: "SELECT", action: "deleting", row: b },
  "SELECT completing": { type: "SELECT", action: "completing", row: b },
  "CLEAR editing": { type: "CLEAR", action: "editing" },
  "CLEAR deleting": { type: "CLEAR", action: "deleting" },
  "CLEAR completing": { type: "CLEAR", action: "completing" },
}

// Independent copy of the header table. Every pair not listed keeps its state.
const selections = {
  "SELECT editing": { status: "editing", row: b },
  "SELECT deleting": { status: "deleting", row: b },
  "SELECT completing": { status: "completing", row: b },
} as const
const TABLE: Record<string, Record<string, RowAction<Row>>> = {
  none: selections,
  editing: { ...selections, "CLEAR editing": { status: "none" } },
  deleting: { ...selections, "CLEAR deleting": { status: "none" } },
  completing: { ...selections, "CLEAR completing": { status: "none" } },
}

describe("row action selection", () => {
  for (const [stateName, state] of Object.entries(STATES))
    for (const [eventName, event] of Object.entries(EVENTS)) {
      const expected = TABLE[stateName][eventName] ?? state
      it(`${stateName} + ${eventName} -> ${expected.status}`, () => {
        expect(transitionRowAction(state, event)).toEqual(expected)
      })
    }

  it("starts with no action", () => {
    expect(NO_ROW_ACTION).toEqual({ status: "none" })
  })
})
