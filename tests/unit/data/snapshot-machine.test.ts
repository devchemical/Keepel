import { describe, expect, it } from "vitest"
import {
  INITIAL_SNAPSHOT_STATE,
  isCurrent,
  requestFreshness,
  snapshotView,
  transitionHistory,
  transitionSnapshot,
  type HistoryEvent,
  type HistoryState,
  type SnapshotEvent,
  type SnapshotState,
} from "@/lib/data/snapshot-machine"
import { SNAPSHOT_LOAD_ERROR_MESSAGE, snapshotLoadError } from "@/lib/data/snapshot-messages"

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
  type Token = { generation: number; request: number; revision: number }
  const scope: Token = { generation: 2, request: 5, revision: 1 }

  // A token's freshness against the owner's scope (the state) and the scope changes (the events).
  const TOKENS: Record<string, Token> = {
    current: { generation: 2, request: 5, revision: 1 },
    revised: { generation: 2, request: 5, revision: 0 },
    "stale request": { generation: 2, request: 4, revision: 1 },
    "stale generation": { generation: 1, request: 5, revision: 1 },
  }
  const SCOPE_EVENTS: Record<string, (value: Token) => Token> = {
    none: (value) => value,
    ACCOUNT_CHANGED: (value) => ({ generation: value.generation + 1, request: 0, revision: 0 }),
    LOAD_STARTED: (value) => ({ ...value, request: value.request + 1 }),
    WRITE_ACCEPTED: (value) => ({ ...value, revision: value.revision + 1 }),
  }
  // Independent copy of the header table.
  const SCOPE_TABLE: Record<string, Record<string, "current" | "revised" | "stale">> = {
    current: { none: "current", ACCOUNT_CHANGED: "stale", LOAD_STARTED: "stale", WRITE_ACCEPTED: "revised" },
    revised: { none: "revised", ACCOUNT_CHANGED: "stale", LOAD_STARTED: "stale", WRITE_ACCEPTED: "revised" },
    "stale request": { none: "stale", ACCOUNT_CHANGED: "stale", LOAD_STARTED: "stale", WRITE_ACCEPTED: "stale" },
    "stale generation": { none: "stale", ACCOUNT_CHANGED: "stale", LOAD_STARTED: "stale", WRITE_ACCEPTED: "stale" },
  }

  for (const [tokenName, token] of Object.entries(TOKENS))
    for (const [eventName, advance] of Object.entries(SCOPE_EVENTS)) {
      const freshness = SCOPE_TABLE[tokenName][eventName]
      it(`${tokenName} + ${eventName} -> ${freshness}`, () => {
        expect(requestFreshness(advance(scope), token)).toBe(freshness)
        expect(isCurrent(advance(scope), token)).toBe(freshness === "current")
      })
    }
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

const loadingHistory = (vehicleId: string): HistoryState<HistoryRecord, Totals> => ({
  status: "loading",
  vehicleId,
  cursors: [undefined],
})

describe("history pagination table", () => {
  type State = HistoryState<HistoryRecord, Totals>
  type Cursors = (HistoryRecord | undefined)[]
  const readyPage = (cursors: Cursors, hasNext: boolean, requested: Cursors = cursors): State => ({
    status: "ready",
    vehicleId: "v1",
    cursors,
    requested,
    page: cursors.length,
    hasNext,
    records: [r("10"), r("11")],
    totals: { record_count: 99 },
  })
  const none: State = { status: "none" }

  const HISTORY_STATES: Record<string, State> = {
    none,
    loading: loadingHistory("v1"),
    "page 1": readyPage([undefined], true),
    "page 2": readyPage([undefined, r("01")], true),
    "last page 2": readyPage([undefined, r("01")], false),
    "page 2 requesting 1": readyPage([undefined, r("01")], true, [undefined]),
  }
  const HISTORY_EVENTS: Record<string, HistoryEvent<HistoryRecord, Totals>> = {
    "SELECT v1": { type: "SELECT", vehicleId: "v1" },
    "SELECT v2": { type: "SELECT", vehicleId: "v2" },
    "SELECT none": { type: "SELECT" },
    "PAGE next": { type: "PAGE", direction: "next" },
    "PAGE previous": { type: "PAGE", direction: "previous" },
    INVALIDATE: { type: "INVALIDATE" },
    "LOADED page 2": {
      type: "LOADED",
      request: { vehicleId: "v1", cursors: [undefined, r("01")] },
      result: { records: [r("10"), r("11")], totals: { record_count: 99 }, hasNext: true },
    },
    "LOADED none": { type: "LOADED", request: null, result: null },
  }
  const loaded = readyPage([undefined, r("01")], true)
  const always = { "SELECT v2": loadingHistory("v2"), "LOADED page 2": loaded, "LOADED none": none }
  const shown = { ...always, "SELECT none": none, INVALIDATE: loadingHistory("v1") }

  // Independent copy of the header table. Every pair not listed keeps its state.
  const HISTORY_TABLE: Record<string, Record<string, State>> = {
    none: { ...always, "SELECT v1": loadingHistory("v1") },
    loading: shown,
    "page 1": { ...shown, "PAGE next": readyPage([undefined], true, [undefined, r("11")]) },
    "page 2": {
      ...shown,
      "PAGE next": readyPage([undefined, r("01")], true, [undefined, r("01"), r("11")]),
      "PAGE previous": readyPage([undefined, r("01")], true, [undefined]),
    },
    "last page 2": { ...shown, "PAGE previous": readyPage([undefined, r("01")], false, [undefined]) },
    "page 2 requesting 1": {
      ...shown,
      "PAGE next": readyPage([undefined, r("01")], true, [undefined, r("01"), r("11")]),
    },
  }

  for (const [stateName, state] of Object.entries(HISTORY_STATES))
    for (const [eventName, event] of Object.entries(HISTORY_EVENTS)) {
      const expected = HISTORY_TABLE[stateName][eventName] ?? state
      it(`${stateName} + ${eventName} -> ${expected.status}`, () => {
        expect(transitionHistory(state, event)).toEqual(expected)
      })
    }
})
