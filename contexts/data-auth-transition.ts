import { AUTH_STATE_STATUS, type AuthState, type CurrentUser } from "@/lib/auth/contracts"

export type DataAuthTransition = { type: "load"; userId: CurrentUser["id"] } | { type: "idle" } | { type: "clear" }

export function resolveDataAuthTransition(authState: AuthState, hasLoaded: boolean): DataAuthTransition {
  if (authState.status === AUTH_STATE_STATUS.ANONYMOUS) {
    return { type: "clear" }
  }

  if (hasLoaded) {
    return { type: "idle" }
  }

  return { type: "load", userId: authState.user.id }
}
