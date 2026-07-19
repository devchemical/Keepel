import {
  AUTH_COMMAND_STATUS,
  AUTH_ERROR_CODE,
  type AuthCommandResult,
  type AuthErrorCode,
  type CurrentUser,
} from "./contracts"

interface PrivateAuthCommandDependencies<Input, SuccessData> {
  requireCurrentUser(): Promise<CurrentUser>
  execute(input: Input, user: CurrentUser): Promise<AuthCommandResult<SuccessData>>
}

function hasAuthErrorCode(error: unknown, code: AuthErrorCode) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code
}

export function createPrivateAuthCommand<Input, SuccessData>({
  requireCurrentUser,
  execute,
}: PrivateAuthCommandDependencies<Input, SuccessData>) {
  return async function runPrivateAuthCommand(input: Input): Promise<AuthCommandResult<SuccessData>> {
    let user: CurrentUser

    try {
      user = await requireCurrentUser()
    } catch (error) {
      return {
        status: AUTH_COMMAND_STATUS.ERROR,
        error: {
          code: hasAuthErrorCode(error, AUTH_ERROR_CODE.AUTHENTICATION_REQUIRED)
            ? AUTH_ERROR_CODE.SESSION_EXPIRED
            : AUTH_ERROR_CODE.UNEXPECTED,
        },
      }
    }

    try {
      return await execute(input, user)
    } catch {
      return {
        status: AUTH_COMMAND_STATUS.ERROR,
        error: { code: AUTH_ERROR_CODE.UNEXPECTED },
      }
    }
  }
}
