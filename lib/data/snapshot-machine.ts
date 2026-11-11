// Data snapshot load (machine 3), request scope guard (4) and history pagination (5).
//
// Snapshot status and fetch activity are separate axes. `freshness` is computed by the owner
// with `requestFreshness` before dispatching a load result.
//
// | from               | event                     | to                                       |
// | ------------------ | ------------------------- | ---------------------------------------- |
// | any                | ACCOUNT_CHANGED signed in | pending, isFetching                      |
// | any                | ACCOUNT_CHANGED signed out| signedOut                                |
// | pending, error     | LOAD_STARTED              | same status, isFetching                  |
// | pending, error     | LOAD_SUCCEEDED current    | ready                                    |
// | pending, error     | LOAD_FAILED current/rev.  | error                                    |
// | ready              | LOAD_STARTED              | ready, isFetching                        |
// | ready              | LOAD_SUCCEEDED current    | ready, refreshError=false                |
// | ready              | LOAD_FAILED current/rev.  | ready, refreshError=true (data kept)     |
// | signed in          | LOAD_SUCCEEDED revised    | same status, not fetching (result drops) |
// | any                | result with stale token   | unchanged                                |
// | signedOut          | LOAD_*                    | unchanged                                |
//
// A result is `revised` when a write was accepted while it was in flight: the result is not
// published, but the request still owns the fetch activity and a failure is still reported.
//
// Request scope guard: a load's token against the owner's scope (`requestFreshness`).
//
// | from    | event (scope change)              | to      |
// | ------- | --------------------------------- | ------- |
// | current | WRITE_ACCEPTED (revision changes) | revised |
// | revised | WRITE_ACCEPTED                    | revised |
// | any     | ACCOUNT_CHANGED (generation)      | stale   |
// | any     | LOAD_STARTED (a newer request)    | stale   |
// | stale   | any                               | stale   |
//
// History pagination:
//
// | from             | event            | to                                                     |
// | ---------------- | ---------------- | ------------------------------------------------------ |
// | any              | SELECT vehicle   | loading page 1 (ignored if already requested)          |
// | any              | SELECT none      | none (ignored if already none)                         |
// | ready            | PAGE next        | ready, requested = committed + last record (if hasNext) |
// | ready            | PAGE previous    | ready, requested = committed - last (if page > 1)      |
// | loading, ready   | INVALIDATE       | loading page 1 of the same vehicle                     |
// | any              | LOADED request   | ready with the requested page, or none                 |
//
// The history is published atomically with the snapshot: the owner dispatches LOADED only for a
// current load, together with LOAD_SUCCEEDED.

import type { HistoryCursor } from "@/lib/data/queries"

export const SNAPSHOT_STATUS = ["signedOut", "pending", "error", "ready"] as const
export type SnapshotStatus = (typeof SNAPSHOT_STATUS)[number]

export type SnapshotState =
  | { status: "signedOut" }
  | { status: "pending"; isFetching: boolean }
  | { status: "error"; isFetching: boolean }
  | { status: "ready"; isFetching: boolean; refreshError: boolean }

export type RequestFreshness = "current" | "revised" | "stale"

export type SnapshotEvent =
  | { type: "ACCOUNT_CHANGED"; signedIn: boolean }
  | { type: "LOAD_STARTED" }
  | { type: "LOAD_SUCCEEDED"; freshness: RequestFreshness }
  | { type: "LOAD_FAILED"; freshness: RequestFreshness }

// Matches the legacy initial flags: not loaded, no error, loading.
export const INITIAL_SNAPSHOT_STATE: SnapshotState = { status: "pending", isFetching: true }

export function transitionSnapshot(state: SnapshotState, event: SnapshotEvent): SnapshotState {
  if (event.type === "ACCOUNT_CHANGED")
    return event.signedIn ? { status: "pending", isFetching: true } : { status: "signedOut" }
  if (state.status === "signedOut") return state
  switch (event.type) {
    case "LOAD_STARTED":
      return { ...state, isFetching: true }
    case "LOAD_SUCCEEDED":
      if (event.freshness === "stale") return state
      if (event.freshness === "revised") return { ...state, isFetching: false }
      return { status: "ready", isFetching: false, refreshError: false }
    case "LOAD_FAILED":
      if (event.freshness === "stale") return state
      return state.status === "ready"
        ? { status: "ready", isFetching: false, refreshError: true }
        : { status: "error", isFetching: false }
    default:
      return event satisfies never
  }
}

export type SnapshotView = "signedOut" | "skeleton" | "blockingError" | "content"

export function snapshotView(state: SnapshotState): SnapshotView {
  switch (state.status) {
    case "signedOut":
      return "signedOut"
    case "pending":
      return "skeleton"
    case "error":
      return "blockingError"
    case "ready":
      return "content"
    default:
      return state satisfies never
  }
}

export function snapshotIsFetching(state: SnapshotState): boolean {
  return state.status !== "signedOut" && state.isFetching
}

// Scope guard. `generation` changes with the account, `request` with every load and `revision`
// with every accepted write.
export interface RequestToken {
  generation: number
  request: number
  revision: number
}

export function requestFreshness(scope: RequestToken, token: RequestToken): RequestFreshness {
  if (scope.generation !== token.generation || scope.request !== token.request) return "stale"
  return scope.revision === token.revision ? "current" : "revised"
}

export function isCurrent(scope: RequestToken, token: RequestToken): boolean {
  return requestFreshness(scope, token) === "current"
}

export type HistoryCursors = (HistoryCursor | undefined)[]
export interface HistoryRequest {
  vehicleId: string
  cursors: HistoryCursors
}
export interface HistoryPage<TRecord, TTotals> {
  records: TRecord[]
  totals: TTotals
  hasNext: boolean
}

export type HistoryState<TRecord extends HistoryCursor, TTotals> =
  | { status: "none" }
  | { status: "loading"; vehicleId: string; cursors: HistoryCursors }
  | {
      status: "ready"
      vehicleId: string
      /** Cursors of the visible page. */
      cursors: HistoryCursors
      /** Cursors the next load requests; differs from `cursors` while paging. */
      requested: HistoryCursors
      page: number
      hasNext: boolean
      records: TRecord[]
      totals: TTotals
    }

export type HistoryEvent<TRecord, TTotals> =
  | { type: "SELECT"; vehicleId?: string }
  | { type: "PAGE"; direction: "next" | "previous" }
  | { type: "INVALIDATE" }
  | { type: "LOADED"; request: HistoryRequest | null; result: HistoryPage<TRecord, TTotals> | null }

export function historyRequest<TRecord extends HistoryCursor, TTotals>(
  state: HistoryState<TRecord, TTotals>
): HistoryRequest | null {
  switch (state.status) {
    case "none":
      return null
    case "loading":
      return { vehicleId: state.vehicleId, cursors: state.cursors }
    case "ready":
      return { vehicleId: state.vehicleId, cursors: state.requested }
    default:
      return state satisfies never
  }
}

export function transitionHistory<TRecord extends HistoryCursor, TTotals>(
  state: HistoryState<TRecord, TTotals>,
  event: HistoryEvent<TRecord, TTotals>
): HistoryState<TRecord, TTotals> {
  switch (event.type) {
    case "SELECT":
      if (historyRequest(state)?.vehicleId === event.vehicleId) return state
      return event.vehicleId
        ? { status: "loading", vehicleId: event.vehicleId, cursors: [undefined] }
        : { status: "none" }
    case "PAGE": {
      if (state.status !== "ready") return state
      const requested = state.cursors.slice(0, state.page)
      if (event.direction === "next") {
        if (!state.hasNext) return state
        requested.push(state.records.at(-1))
      } else {
        if (state.page <= 1) return state
        requested.pop()
      }
      return { ...state, requested }
    }
    case "INVALIDATE":
      return state.status === "none" ? state : { status: "loading", vehicleId: state.vehicleId, cursors: [undefined] }
    case "LOADED":
      if (!event.request || !event.result) return { status: "none" }
      return {
        status: "ready",
        vehicleId: event.request.vehicleId,
        cursors: event.request.cursors,
        requested: event.request.cursors,
        page: event.request.cursors.length,
        ...event.result,
      }
    default:
      return event satisfies never
  }
}
