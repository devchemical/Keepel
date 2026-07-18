export const AUTH_STATE_STATUS = {
  ANONYMOUS: "anonymous",
  AUTHENTICATED: "authenticated",
} as const

export const AUTH_COMMAND_STATUS = {
  SUCCESS: "success",
  ERROR: "error",
} as const

export const AUTH_ERROR_CODE = {
  AUTHENTICATION_REQUIRED: "authentication_required",
  INVALID_CREDENTIALS: "invalid_credentials",
  RATE_LIMITED: "rate_limited",
  VALIDATION_FAILED: "validation_failed",
  PROVIDER_ERROR: "provider_error",
  SESSION_EXPIRED: "session_expired",
  UNEXPECTED: "unexpected",
} as const

export const SIGN_UP_STATUS = {
  AUTHENTICATED: "authenticated",
  CONFIRMATION_REQUIRED: "confirmation_required",
  ERROR: "error",
} as const

export const SIGN_UP_RATE_LIMIT_SCOPE = {
  IP: "ip",
  EMAIL: "email",
} as const

type ValueOf<T> = T[keyof T]

declare const userIdBrand: unique symbol

export type UserId = string & { readonly [userIdBrand]: "UserId" }

export type AuthErrorCode = ValueOf<typeof AUTH_ERROR_CODE>

export type SignUpRateLimitScope = ValueOf<typeof SIGN_UP_RATE_LIMIT_SCOPE>

export type AuthError = {
  [Code in AuthErrorCode]: { code: Code }
}[AuthErrorCode]

export interface CurrentUser {
  id: UserId
  email: string | null
  displayName: string
}

export type AuthState =
  | {
      status: typeof AUTH_STATE_STATUS.ANONYMOUS
      user: null
    }
  | {
      status: typeof AUTH_STATE_STATUS.AUTHENTICATED
      user: CurrentUser
    }

export type AuthCommandResult<SuccessData = undefined> =
  | {
      status: typeof AUTH_COMMAND_STATUS.SUCCESS
      data: SuccessData
    }
  | {
      status: typeof AUTH_COMMAND_STATUS.ERROR
      error: AuthError
    }

export type SignUpError =
  | Exclude<AuthError, { code: typeof AUTH_ERROR_CODE.RATE_LIMITED }>
  | {
      code: typeof AUTH_ERROR_CODE.RATE_LIMITED
      scope: SignUpRateLimitScope
      remaining: number
      limit: number
      reset: number
    }

export type SignUpResult =
  | {
      status: typeof SIGN_UP_STATUS.AUTHENTICATED
      user: CurrentUser
    }
  | {
      status: typeof SIGN_UP_STATUS.CONFIRMATION_REQUIRED
    }
  | {
      status: typeof SIGN_UP_STATUS.ERROR
      error: SignUpError
    }
