"use server"

/* eslint-disable no-console -- Server actions log unexpected auth failures until centralized observability is added. */

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import {
  AUTH_COMMAND_STATUS,
  AUTH_ERROR_CODE,
  SIGN_UP_RATE_LIMIT_SCOPE,
  SIGN_UP_STATUS,
  type SignUpResult,
} from "@/lib/auth/contracts"
import { createPasswordLoginCommand, type PasswordLoginResult } from "@/lib/auth/password-login"
import { createLogoutCommand, type LogoutResult } from "@/lib/auth/logout"
import { getCurrentUser, requireCurrentUser } from "@/lib/auth/server"
import { createSignupCommand } from "@/lib/auth/signup"
import { createSupabasePasswordLoginAuthAdapter } from "@/lib/auth/supabase-password-login-adapter"
import { createSupabaseLogoutAuthAdapter } from "@/lib/auth/supabase-logout-adapter"
import { createSupabaseSignupAuthAdapter } from "@/lib/auth/supabase-signup-adapter"
import { loginRateLimiter, signupRateLimiter } from "@/lib/ratelimit"
import { createClient } from "@/lib/supabase/server"

const passwordLogin = createPasswordLoginCommand({
  authAdapter: createSupabasePasswordLoginAuthAdapter(createClient),
  rateLimitAdapter: {
    async isAllowed({ email, clientIp }) {
      const [emailLimit, ipLimit] = await Promise.all([
        loginRateLimiter.limit(`login_email_${email}`),
        loginRateLimiter.limit(`login_ip_${clientIp}`),
      ])

      return emailLimit.success && ipLimit.success
    },
  },
})

const logout = createLogoutCommand({
  authAdapter: createSupabaseLogoutAuthAdapter(createClient),
  requireCurrentUser,
})

const signup = createSignupCommand({
  authAdapter: createSupabaseSignupAuthAdapter(createClient),
  rateLimitAdapter: {
    async isAllowed({ email, clientIp }) {
      const ipLimit = await signupRateLimiter.limit(`signup_ip_${clientIp}`)

      if (!ipLimit.success) {
        return {
          allowed: false,
          scope: SIGN_UP_RATE_LIMIT_SCOPE.IP,
          remaining: ipLimit.remaining,
          limit: ipLimit.limit,
          reset: ipLimit.reset,
        }
      }

      const emailLimit = await signupRateLimiter.limit(`signup_email_${email}`)

      return emailLimit.success
        ? { allowed: true }
        : {
            allowed: false,
            scope: SIGN_UP_RATE_LIMIT_SCOPE.EMAIL,
            remaining: emailLimit.remaining,
            limit: emailLimit.limit,
            reset: emailLimit.reset,
          }
    },
  },
})

function readClientIp(headersList: Headers) {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || headersList.get("x-real-ip")?.trim() || "127.0.0.1"
  )
}

export async function loginAction(
  _previousResult: PasswordLoginResult | null,
  formData: FormData
): Promise<PasswordLoginResult> {
  try {
    const headersList = await headers()

    return await passwordLogin({
      email: formData.get("email"),
      password: formData.get("password"),
      clientIp: readClientIp(headersList),
      redirectTo: formData.get("redirectTo"),
    })
  } catch (error) {
    console.error("Unexpected password login action failure:", error)

    return {
      status: AUTH_COMMAND_STATUS.ERROR,
      error: { code: AUTH_ERROR_CODE.UNEXPECTED },
    }
  }
}

export async function logoutAction(_previousResult: LogoutResult | null, _formData: FormData): Promise<LogoutResult> {
  const result = await logout()

  if (result.status === AUTH_COMMAND_STATUS.SUCCESS) {
    revalidatePath("/", "layout")
  }

  return result
}

export async function signupAction(_previousResult: SignUpResult | null, formData: FormData): Promise<SignUpResult> {
  try {
    const currentUser = await getCurrentUser()

    if (currentUser) {
      return { status: SIGN_UP_STATUS.AUTHENTICATED, user: currentUser }
    }

    const headersList = await headers()

    return await signup({
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
      fullName: formData.get("fullName"),
      clientIp: readClientIp(headersList),
      emailRedirectTo:
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URL ||
        "http://localhost:3000/",
    })
  } catch (error) {
    console.error("Unexpected signup action failure:", error)

    return {
      status: SIGN_UP_STATUS.ERROR,
      error: { code: AUTH_ERROR_CODE.UNEXPECTED },
    }
  }
}
