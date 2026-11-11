import { describe, expect, it } from "vitest"
import {
  INITIAL_SNAPSHOT_STATE,
  SNAPSHOT_LOAD_ERROR_MESSAGE,
  isCurrent,
  requestFreshness,
  snapshotLoadError,
  snapshotView,
  transitionHistory,
  transitionSnapshot,
  type HistoryState,
  type SnapshotEvent,
  type SnapshotState,
} from "@/lib/data/snapshot-machine"

const signedOut: SnapshotState = { status: "signedOut" }
const pending = (isFetching: boolean): SnapshotState => ({ status: "pending", isFetching })
const failed = (isFetching: boolean): SnapshotState => ({ status: "error", isFetching })
const ready = (isFetching: boolean, refreshError: boolean): SnapshotState => ({
  status: "ready",
  isFetching,
  refreshError,
})

const STATES: Record<string, SnapshotState> = {
  signedOut,
  "pending idle": pending(false),
  "pending fetching": pending(true),
  "error idle": failed(false),
  "error fetching": failed(true),
  "ready idle": ready(false, false),
  "ready fetching": ready(true, false),
  "ready refreshError": ready(false, true),
  "ready refreshError fetching": ready(true, true),
}

const EVENTS: Record<string, SnapshotEvent> = {
  "ACCOUNT_CHANGED signed in": { type: "ACCOUNT_CHANGED", signedIn: true },
  "ACCOUNT_CHANGED signed out": { type: "ACCOUNT_CHANGED", signedIn: false },
  LOAD_STARTED: { type: "LOAD_STARTED" },
  "LOAD_SUCCEEDED current": { type: "LOAD_SUCCEEDED", freshness: "current" },
  "LOAD_SUCCEEDED revised": { type: "LOAD_SUCCEEDED", freshness: "revised" },
  "LOAD_SUCCEEDED stale": { type: "LOAD_SUCCEEDED", freshness: "stale" },
  "LOAD_FAILED current": { type: "LOAD_FAILED", freshness: "current" },
  "LOAD_FAILED revised": { type: "LOAD_FAILED", freshness: "revised" },
  "LOAD_FAILED stale": { type: "LOAD_FAILED", freshness: "stale" },
}

// Expected next state for every state × event pair. Mirrors the header table in
// lib/data/snapshot-machine.ts; "same" means the event is ignored.
const TABLE: Record<string, Record<string, SnapshotState | "same">> = {
  signedOut: {
    "ACCOUNT_CHANGED signed in": pending(true),
    "ACCOUNT_CHANGED signed out": signedOut,
    LOAD_STARTED: "same",
    "LOAD_SUCCEEDED current": "same",
    "LOAD_SUCCEEDED revised": "same",
    "LOAD_SUCCEEDED stale": "same",
    "LOAD_FAILED current": "same",
    "LOAD_FAILED revised": "same",
    "LOAD_FAILED stale": "same",
  },
}
for (const [name, state] of Object.entries(STATES)) {
  if (state.status === "signedOut") continue
  TABLE[name] = {
    "ACCOUNT_CHANGED signed in": pending(true),
    "ACCOUNT_CHANGED signed out": signedOut,
    LOAD_STARTED: { ...state, isFetching: true },
    "LOAD_SUCCEEDED current": ready(false, false),
    // A write committed during the load: its result is discarded, the snapshot is kept.
    "LOAD_SUCCEEDED revised": { ...state, isFetching: false },
    "LOAD_SUCCEEDED stale": "same",
    "LOAD_FAILED current": state.status === "ready" ? ready(false, true) : failed(false),
    "LOAD_FAILED revised": state.status === "ready" ? ready(false, true) : failed(false),
    "LOAD_FAILED stale": "same",
  }
}

describe("data snapshot load machine", () => {
  for (const [stateName, state] of Object.entries(STATES)) {
    for (const [eventName, event] of Object.entries(EVENTS)) {
      it(`${stateName} + ${eventName}`, () => {
        const expected = TABLE[stateName][eventName]
        const next = transitionSnapshot(state, event)
        if (expected === "same") expect(next).toBe(state)
        else expect(next).toEqual(expected)
      })
    }
  }

  it("starts pending and fetching, as the legacy loading flags did", () => {
    expect(INITIAL_SNAPSHOT_STATE).toEqual(pending(true))
  })
})

// Characterization of the removed contexts/data-auth-transition.ts cases.
describe("data snapshot across authentication changes", () => {
  it("loads authenticated data once, then stays loaded across repeated renders", () => {
    let state = transitionSnapshot(INITIAL_SNAPSHOT_STATE, { type: "ACCOUNT_CHANGED", signedIn: true })
    expect(state).toEqual(pending(true))
    state = transitionSnapshot(state, { type: "LOAD_SUCCEEDED", freshness: "current" })
    expect(state.status).toBe("ready")
  })

  it("clears anonymous data and permits a later authenticated reload", () => {
    const anonymous = transitionSnapshot(ready(false, false), { type: "ACCOUNT_CHANGED", signedIn: false })
    expect(anonymous).toEqual(signedOut)
    expect(transitionSnapshot(anonymous, { type: "ACCOUNT_CHANGED", signedIn: true })).toEqual(pending(true))
  })

  it("keeps the last valid snapshot visible when a refresh fails", () => {
    const state = transitionSnapshot(ready(true, false), { type: "LOAD_FAILED", freshness: "current" })
    expect(snapshotView(state)).toBe("content")
    expect(snapshotLoadError(state)).toBe(SNAPSHOT_LOAD_ERROR_MESSAGE)
  })
})

describe("snapshot view", () => {
  it.each([
    [signedOut, "signedOut", null],
    [pending(true), "skeleton", null],
    [pending(false), "skeleton", null],
    [failed(false), "blockingError", SNAPSHOT_LOAD_ERROR_MESSAGE],
    [failed(true), "blockingError", SNAPSHOT_LOAD_ERROR_MESSAGE],
    [ready(false, false), "content", null],
    [ready(true, true), "content", SNAPSHOT_LOAD_ERROR_MESSAGE],
  ] as const)("%o is %s", (state, view, error) => {
    expect(snapshotView(state)).toBe(view)
    expect(snapshotLoadError(state)).toBe(error)
  })

  it("keeps the legacy copy verbatim", () => {
    expect(SNAPSHOT_LOAD_ERROR_MESSAGE).toBe("No se pudieron cargar los datos. Se conservan los últimos datos válidos.")
  })
})

describe("request scope guard", () => {
  const scope = { generation: 2, request: 5, revision: 1 }

  it.each([
    [{ generation: 2, request: 5, revision: 1 }, "current"],
    [{ generation: 2, request: 5, revision: 0 }, "revised"],
    [{ generation: 2, request: 4, revision: 1 }, "stale"],
    [{ generation: 1, request: 5, revision: 1 }, "stale"],
  ] as const)("%o is %s", (token, freshness) => {
    expect(requestFreshness(scope, token)).toBe(freshness)
    expect(isCurrent(scope, token)).toBe(freshness === "current")
  })
})

type HistoryRecord = { id: string; service_date: string }
type Totals = { record_count: number }
const r = (id: string): HistoryRecord => ({ id, service_date: `2026-01-${id}` })
const page = (records: HistoryRecord[], hasNext: boolean) => ({ records, totals: { record_count: 99 }, hasNext })

describe("history pagination", () => {
  type State = HistoryState<HistoryRecord, Totals>
  const none: State = { status: "none" }
  const readyPage = (cursors: (HistoryRecord | undefined)[], hasNext = true, requested = cursors): State => ({
    status: "ready",
    vehicleId: "v1",
    cursors,
    requested,
    page: cursors.length,
    hasNext,
    records: [r("10"), r("11")],
    totals: { record_count: 99 },
  })

  it("selecting a vehicle requests its first page and hides the previous history", () => {
    expect(transitionHistory(none, { type: "SELECT", vehicleId: "v1" })).toEqual({
      status: "loading",
      vehicleId: "v1",
      cursors: [undefined],
    })
    expect(transitionHistory(readyPage([undefined]), { type: "SELECT", vehicleId: "v2" })).toEqual({
      status: "loading",
      vehicleId: "v2",
      cursors: [undefined],
    })
    expect(transitionHistory(readyPage([undefined]), { type: "SELECT" })).toEqual(none)
  })

  it("selecting the already requested vehicle, or none twice, is ignored", () => {
    const loading: State = { status: "loading", vehicleId: "v1", cursors: [undefined] }
    expect(transitionHistory(loading, { type: "SELECT", vehicleId: "v1" })).toBe(loading)
    const shown = readyPage([undefined])
    expect(transitionHistory(shown, { type: "SELECT", vehicleId: "v1" })).toBe(shown)
    expect(transitionHistory(none, { type: "SELECT" })).toBe(none)
  })

  it("paging requests from the committed cursors and keeps the current page visible", () => {
    const shown = readyPage([undefined, r("01")])
    expect(transitionHistory(shown, { type: "PAGE", direction: "next" })).toEqual(
      readyPage([undefined, r("01")], true, [undefined, r("01"), r("11")])
    )
    expect(transitionHistory(shown, { type: "PAGE", direction: "previous" })).toEqual(
      readyPage([undefined, r("01")], true, [undefined])
    )
  })

  it("repeating a failed previous request pages from the committed page, not the request", () => {
    const failedPrevious = readyPage([undefined, r("01")], true, [undefined])
    expect(transitionHistory(failedPrevious, { type: "PAGE", direction: "previous" })).toEqual(failedPrevious)
  })

  it("ignores paging past either end and paging without a visible page", () => {
    const last = readyPage([undefined, r("01")], false)
    const first = readyPage([undefined])
    const loading: State = { status: "loading", vehicleId: "v1", cursors: [undefined] }
    expect(transitionHistory(last, { type: "PAGE", direction: "next" })).toBe(last)
    expect(transitionHistory(first, { type: "PAGE", direction: "previous" })).toBe(first)
    expect(transitionHistory(loading, { type: "PAGE", direction: "next" })).toBe(loading)
    expect(transitionHistory(none, { type: "PAGE", direction: "next" })).toBe(none)
  })

  it("invalidation returns to the first page of the same vehicle", () => {
    expect(transitionHistory(readyPage([undefined, r("01")]), { type: "INVALIDATE" })).toEqual({
      status: "loading",
      vehicleId: "v1",
      cursors: [undefined],
    })
    expect(transitionHistory(none, { type: "INVALIDATE" })).toBe(none)
  })

  it("a committed load publishes the page it requested", () => {
    const request = { vehicleId: "v1", cursors: [undefined, r("01")] }
    expect(transitionHistory(none, { type: "LOADED", request, result: page([r("10"), r("11")], true) })).toEqual(
      readyPage([undefined, r("01")])
    )
    expect(transitionHistory(readyPage([undefined]), { type: "LOADED", request: null, result: null })).toEqual(none)
  })
})
