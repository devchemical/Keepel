import { AUTH_ERROR_CODE, SIGN_UP_STATUS, type SignUpRateLimitScope, type SignUpResult } from "./contracts"
import { parseSignupInput } from "./signup-validation"

export interface SignupInput {
  email: unknown
  password: unknown
  confirmPassword: unknown
  fullName: unknown
  clientIp: string
  emailRedirectTo: string
}

export interface SignupAuthAdapter {
  signUp(input: { email: string; password: string; fullName: string; emailRedirectTo: string }): Promise<SignUpResult>
}

export interface SignupRateLimitAdapter {
  isAllowed(input: { email: string; clientIp: string }): Promise<
    | { allowed: true }
    | {
        allowed: false
        scope: SignUpRateLimitScope
        remaining: number
        limit: number
        reset: number
      }
  >
}

interface SignupDependencies {
  authAdapter: SignupAuthAdapter
  rateLimitAdapter: SignupRateLimitAdapter
}

export function createSignupCommand({ authAdapter, rateLimitAdapter }: SignupDependencies) {
  return async function signup(input: SignupInput): Promise<SignUpResult> {
    const signupInput = parseSignupInput(input)

    if (!signupInput.success) {
      return {
        status: SIGN_UP_STATUS.ERROR,
        error: { code: AUTH_ERROR_CODE.VALIDATION_FAILED },
      }
    }

    const { email, password, fullName } = signupInput.data

    try {
      const rateLimit = await rateLimitAdapter.isAllowed({ email, clientIp: input.clientIp })

      if (!rateLimit.allowed) {
        return {
          status: SIGN_UP_STATUS.ERROR,
          error: {
            code: AUTH_ERROR_CODE.RATE_LIMITED,
            scope: rateLimit.scope,
            remaining: rateLimit.remaining,
            limit: rateLimit.limit,
            reset: rateLimit.reset,
          },
        }
      }

      return await authAdapter.signUp({
        email,
        password,
        fullName,
        emailRedirectTo: input.emailRedirectTo,
      })
    } catch {
      return {
        status: SIGN_UP_STATUS.ERROR,
        error: { code: AUTH_ERROR_CODE.UNEXPECTED },
      }
    }
  }
}
