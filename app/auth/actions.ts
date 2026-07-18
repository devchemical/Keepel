"use server"

/* eslint-disable no-console -- Server actions log unexpected auth failures until centralized observability is added. */

import { headers } from "next/headers"
import { AUTH_COMMAND_STATUS, AUTH_ERROR_CODE } from "@/lib/auth/contracts"
import { createPasswordLoginCommand, type PasswordLoginResult } from "@/lib/auth/password-login"
import { createSupabasePasswordLoginAuthAdapter } from "@/lib/auth/supabase-password-login-adapter"
import { loginRateLimiter, signupRateLimiter } from "@/lib/ratelimit"
import { createClient } from "@/lib/supabase/server"

interface SignupResult {
  success: boolean
  error?: string
  rateLimit?: {
    remaining: number
    limit: number
    reset: number
  }
  redirectTo?: string
}

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

export async function signupAction(email: string, password: string, fullName: string): Promise<SignupResult> {
  try {
    // Obtener IP del usuario
    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? headersList.get("x-real-ip") ?? "127.0.0.1"

    const sanitizedEmail = email.toLowerCase().trim()

    // Verificar rate limit por IP
    const ipLimit = await signupRateLimiter.limit(`signup_ip_${ip}`)

    if (!ipLimit.success) {
      return {
        success: false,
        error: "Demasiados intentos de registro desde esta IP. Intenta más tarde.",
        rateLimit: {
          remaining: 0,
          limit: ipLimit.limit,
          reset: ipLimit.reset,
        },
      }
    }

    // Verificar rate limit por email
    const emailLimit = await signupRateLimiter.limit(`signup_email_${sanitizedEmail}`)

    if (!emailLimit.success) {
      return {
        success: false,
        error: "Demasiados intentos de registro para este email. Por seguridad, espera un momento.",
        rateLimit: {
          remaining: 0,
          limit: emailLimit.limit,
          reset: emailLimit.reset,
        },
      }
    }

    // Intentar registro con Supabase
    const supabase = await createClient()
    const redirectUrl =
      process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_REDIRECT_URL ||
      "http://localhost:3000/"

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      return {
        success: false,
        error: error.message,
        rateLimit: {
          remaining: emailLimit.remaining,
          limit: emailLimit.limit,
          reset: emailLimit.reset,
        },
      }
    }

    return {
      success: true,
      redirectTo: "/auth/signup-success",
    }
  } catch (error) {
    console.error("Error en signupAction:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}
