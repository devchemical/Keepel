import { AUTH_COMMAND_STATUS, AUTH_ERROR_CODE, type AuthCommandResult } from "./contracts"
import { sanitizeInternalRedirect } from "./redirects"
import { parsePasswordLoginCredentials } from "./password-login-validation"

export interface PasswordLoginInput {
  email: unknown
  password: unknown
  clientIp: string
  redirectTo: unknown
}

export type PasswordLoginResult = AuthCommandResult<{ redirectTo: string }>

export type PasswordLoginFailureCode =
  | typeof AUTH_ERROR_CODE.INVALID_CREDENTIALS
  | typeof AUTH_ERROR_CODE.PROVIDER_ERROR

export type PasswordLoginAdapterResult =
  | { authenticated: true }
  | { authenticated: false; errorCode: PasswordLoginFailureCode }

export interface PasswordLoginAuthAdapter {
  signInWithPassword(credentials: { email: string; password: string }): Promise<PasswordLoginAdapterResult>
}

export interface PasswordLoginRateLimitAdapter {
  isAllowed(input: { email: string; clientIp: string }): Promise<boolean>
}

interface PasswordLoginDependencies {
  authAdapter: PasswordLoginAuthAdapter
  rateLimitAdapter: PasswordLoginRateLimitAdapter
}

export function createPasswordLoginCommand({ authAdapter, rateLimitAdapter }: PasswordLoginDependencies) {
  return async function login(input: PasswordLoginInput): Promise<PasswordLoginResult> {
    const credentials = parsePasswordLoginCredentials({
      email: input.email,
      password: input.password,
    })

    if (!credentials.success) {
      return {
        status: AUTH_COMMAND_STATUS.ERROR,
        error: { code: AUTH_ERROR_CODE.VALIDATION_FAILED },
      }
    }

    const { email, password } = credentials.data

    try {
      if (!(await rateLimitAdapter.isAllowed({ email, clientIp: input.clientIp }))) {
        return {
          status: AUTH_COMMAND_STATUS.ERROR,
          error: { code: AUTH_ERROR_CODE.RATE_LIMITED },
        }
      }

      const result = await authAdapter.signInWithPassword({ email, password })

      if (!result.authenticated) {
        return {
          status: AUTH_COMMAND_STATUS.ERROR,
          error: { code: result.errorCode },
        }
      }

      return {
        status: AUTH_COMMAND_STATUS.SUCCESS,
        data: { redirectTo: sanitizeInternalRedirect(input.redirectTo) },
      }
    } catch {
      return {
        status: AUTH_COMMAND_STATUS.ERROR,
        error: { code: AUTH_ERROR_CODE.UNEXPECTED },
      }
    }
  }
}
