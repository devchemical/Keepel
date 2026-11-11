import { describe, expect, it } from "vitest"
import {
  JOURNAL_HEALTH,
  OPERATION_POLICY,
  OPERATION_STATUS,
  conflictsWith,
  operationKind,
  transitionJournal,
  transitionOperation,
  type JournalEvent,
  type JournalHealth,
  type OperationEvent,
  type OperationStatus,
  type PendingOperation,
} from "@/lib/data/operation-machine"
import type { PendingCommand } from "@/lib/data/pending-operations"

const EVENTS: OperationEvent[] = [
  { type: "RECEIPT" },
  { type: "REJECTED" },
  { type: "NO_PROOF" },
  { type: "CHECK" },
  { type: "REPLAY", replayable: true },
  { type: "REPLAY", replayable: false },
  { type: "RESTORED" },
]

const name = (event: OperationEvent) =>
  event.type === "REPLAY" ? `REPLAY(${event.replayable ? "replayable" : "not replayable"})` : event.type

// Independent copy of the header table: every pair not listed keeps its state.
const TABLE: Partial<Record<OperationStatus, Record<string, OperationStatus>>> = {
  sending: { RECEIPT: "confirmed", REJECTED: "rejected", NO_PROOF: "unknown", RESTORED: "unknown" },
  unknown: { CHECK: "checking", "REPLAY(replayable)": "sending" },
  checking: { RECEIPT: "confirmed", NO_PROOF: "unknown", RESTORED: "unknown" },
}

describe("data operation lifecycle", () => {
  for (const status of OPERATION_STATUS)
    for (const event of EVENTS) {
      const expected = TABLE[status]?.[name(event)] ?? status
      it(`${status} + ${name(event)} -> ${expected}`, () => {
        expect(transitionOperation(status, event)).toBe(expected)
      })
    }
})

const JOURNAL_EVENTS: JournalEvent["type"][] = ["RESTORED", "RESTORE_FAILED", "WRITTEN", "WRITE_FAILED"]
const JOURNAL_TABLE: Record<JournalHealth, Record<JournalEvent["type"], JournalHealth>> = {
  healthy: { RESTORED: "healthy", RESTORE_FAILED: "unreadable", WRITTEN: "healthy", WRITE_FAILED: "unwritable" },
  unwritable: { RESTORED: "healthy", RESTORE_FAILED: "unreadable", WRITTEN: "healthy", WRITE_FAILED: "unwritable" },
  unreadable: { RESTORED: "healthy", RESTORE_FAILED: "unreadable", WRITTEN: "unreadable", WRITE_FAILED: "unreadable" },
}

describe("operation journal health", () => {
  for (const health of JOURNAL_HEALTH)
    for (const type of JOURNAL_EVENTS)
      it(`${health} + ${type} -> ${JOURNAL_TABLE[health][type]}`, () => {
        expect(transitionJournal(health, { type })).toBe(JOURNAL_TABLE[health][type])
      })
})

describe("operation policy (docs/testing/data-owner.md)", () => {
  it("classifies only the maintenance batch as a batch command", () => {
    expect(operationKind("maintenance.batch")).toBe("batch")
    for (const action of ["vehicle.create", "vehicle.delete", "maintenance.update", "schedule.cancel"] as const)
      expect(operationKind(action)).toBe("crud")
  })

  it("lets CRUD send without a durable journal, never auto-checks and allows an explicit replay (D2)", () => {
    expect(OPERATION_POLICY.crud).toEqual({
      requiresDurableJournal: false,
      autoCheckAfterNoProof: false,
      replayable: true,
    })
  })

  it("never sends a batch without a durable journal, auto-checks once and allows an explicit replay", () => {
    expect(OPERATION_POLICY.batch).toEqual({
      requiresDurableJournal: true,
      autoCheckAfterNoProof: true,
      replayable: true,
    })
  })
})

const VEHICLE = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const OPERATION = "33333333-3333-4333-8333-333333333333"
const crud = (action: "vehicle.create" | "vehicle.update" | "schedule.create", id: string): PendingCommand =>
  ({ operationId: OPERATION, action, id, values: {} }) as unknown as PendingCommand
const batch = (operationId: string): PendingCommand =>
  ({ operationId, action: "maintenance.batch" }) as unknown as PendingCommand
const pending = (command: PendingCommand, status: PendingOperation["status"] = "unknown"): PendingOperation => ({
  command,
  status,
})

describe("submission conflicts", () => {
  it("blocks a CRUD command on a resource that already has a pending command", () => {
    expect(
      conflictsWith(pending(crud("vehicle.update", VEHICLE)), {
        action: "vehicle.update",
        operationId: OTHER,
        id: VEHICLE,
      })
    ).toBe(true)
  })

  it("allows a CRUD command on a different resource", () => {
    expect(
      conflictsWith(pending(crud("vehicle.update", VEHICLE)), {
        action: "vehicle.update",
        operationId: OTHER,
        id: OTHER,
      })
    ).toBe(false)
  })

  it("blocks a second create of the same kind but not of another kind", () => {
    const create = pending(crud("vehicle.create", VEHICLE))
    expect(conflictsWith(create, { action: "vehicle.create", operationId: OTHER, id: OTHER })).toBe(true)
    expect(conflictsWith(create, { action: "schedule.create", operationId: OTHER, id: OTHER })).toBe(false)
  })

  it("does not let a pending batch block CRUD, nor CRUD block a batch", () => {
    expect(conflictsWith(pending(batch(OPERATION)), { action: "vehicle.create", operationId: OTHER, id: OTHER })).toBe(
      false
    )
    expect(
      conflictsWith(pending(crud("vehicle.create", VEHICLE)), { action: "maintenance.batch", operationId: OTHER })
    ).toBe(false)
  })

  it("blocks a different batch while one is pending", () => {
    expect(conflictsWith(pending(batch(OPERATION)), { action: "maintenance.batch", operationId: OTHER })).toBe(true)
  })

  it("lets an unresolved CRUD command replay only through its kind's policy (D2)", () => {
    const replay = {
      type: "REPLAY",
      replayable: OPERATION_POLICY[operationKind("schedule.create")].replayable,
    } as const
    expect(transitionOperation("unknown", replay)).toBe("sending")
    expect(transitionOperation("sending", replay)).toBe("sending")
    expect(transitionOperation("checking", replay)).toBe("checking")
  })

  it("allows only an explicit replay of the same unresolved batch", () => {
    const candidate = { action: "maintenance.batch", operationId: OPERATION } as const
    expect(conflictsWith(pending(batch(OPERATION), "unknown"), candidate)).toBe(false)
    expect(conflictsWith(pending(batch(OPERATION), "sending"), candidate)).toBe(true)
    expect(conflictsWith(pending(batch(OPERATION), "checking"), candidate)).toBe(true)
  })
})
