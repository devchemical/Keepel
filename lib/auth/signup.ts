import { AUTH_ERROR_CODE, SIGN_UP_STATUS, type SignUpResult } from "./contracts"
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
  isAllowed(input: { email: string; clientIp: string }): Promise<boolean>
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
      if (!(await rateLimitAdapter.isAllowed({ email, clientIp: input.clientIp }))) {
        return {
          status: SIGN_UP_STATUS.ERROR,
          error: { code: AUTH_ERROR_CODE.RATE_LIMITED },
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
