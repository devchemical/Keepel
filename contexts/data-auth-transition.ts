import { AUTH_STATE_STATUS, type AuthState, type CurrentUser } from "@/lib/auth/contracts"

interface LoadDataAuthTransition {
  type: "load"
  userId: CurrentUser["id"]
}

interface IdleDataAuthTransition {
  type: "idle"
}

interface ClearDataAuthTransition {
  type: "clear"
}

export type DataAuthTransition = LoadDataAuthTransition | IdleDataAuthTransition | ClearDataAuthTransition

export function resolveDataAuthTransition(authState: AuthState, hasLoaded: boolean): DataAuthTransition {
  if (authState.status === AUTH_STATE_STATUS.ANONYMOUS) {
    return { type: "clear" }
  }

  if (hasLoaded) {
    return { type: "idle" }
  }

  return { type: "load", userId: authState.user.id }
}
