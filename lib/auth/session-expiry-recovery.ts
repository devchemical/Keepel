import { AUTH_COMMAND_STATUS, AUTH_ERROR_CODE, type AuthCommandResult } from "./contracts"
import { sanitizeInternalRedirect } from "./redirects"

interface SessionExpiredRecoveryDependencies {
  invalidateProjection(): void
  navigate(destination: string): void
  refreshNavigation(): void
}

export function createSessionExpiredRecovery({
  invalidateProjection,
  navigate,
  refreshNavigation,
}: SessionExpiredRecoveryDependencies) {
  return function recoverSession(result: AuthCommandResult<unknown>, returnTo: unknown) {
    if (result.status !== AUTH_COMMAND_STATUS.ERROR || result.error.code !== AUTH_ERROR_CODE.SESSION_EXPIRED) {
      return false
    }

    const searchParams = new URLSearchParams({ redirect: sanitizeInternalRedirect(returnTo) })

    invalidateProjection()
    refreshNavigation()
    navigate(`/auth/login?${searchParams.toString()}`)

    return true
  }
}
