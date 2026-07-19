import { type AuthCommandResult, type CurrentUser } from "./contracts"
import { createPrivateAuthCommand } from "./private-command"

export type LogoutResult = AuthCommandResult<null>

export interface LogoutAuthAdapter {
  signOut(): Promise<LogoutResult>
}

interface LogoutDependencies {
  authAdapter: LogoutAuthAdapter
  requireCurrentUser(): Promise<CurrentUser>
}

export function createLogoutCommand({ authAdapter, requireCurrentUser }: LogoutDependencies) {
  const runLogout = createPrivateAuthCommand<void, null>({
    requireCurrentUser,
    execute: () => authAdapter.signOut(),
  })

  return async function logout(): Promise<LogoutResult> {
    return runLogout()
  }
}
