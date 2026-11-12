// The only place that maps data snapshot states (machine 3) to Spanish copy.
// Strings are user-visible contracts asserted by e2e tests; change them deliberately.

import type { SnapshotState } from "./snapshot-machine"

export const SNAPSHOT_LOAD_ERROR_MESSAGE = "No se pudieron cargar los datos. Se conservan los últimos datos válidos."

/** Copy for a failed load, whether blocking or a refresh that kept the last valid data. */
export function snapshotLoadError(state: SnapshotState): string | null {
  return state.status === "error" || (state.status === "ready" && state.refreshError)
    ? SNAPSHOT_LOAD_ERROR_MESSAGE
    : null
}
