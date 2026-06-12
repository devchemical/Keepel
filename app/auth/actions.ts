"use server"

/* eslint-disable no-console -- Server actions log unexpected auth failures until centralized observability is added. */

import { createClient } from "@/lib/supabase/server"
import { loginRateLimiter, signupRateLimiter } from "@/lib/ratelimit"
import { headers } from "next/headers"

interface AuthResult {
  success: boolean
  error?: string
  rateLimit?: {
    remaining: number
    limit: number
    reset: number
  }
  redirectTo?: string
  session?: {
    accessToken: string
    refreshToken: string
  }
}

export async function loginAction(email: string, password: string): Promise<AuthResult> {
  try {
    // Obtener IP del usuario
    const headersList = await headers()
    const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? headersList.get("x-real-ip") ?? "127.0.0.1"

    const sanitizedEmail = email.toLowerCase().trim()

    // Verificar rate limit primero por email por si la ip es compartida
    const emailLimit = await loginRateLimiter.limit(`login_email_${sanitizedEmail}`)
    const ipLimit = await loginRateLimiter.limit(`login_ip_${ip}`)

    if (!emailLimit.success) {
      return {
        success: false,
        error: "Demasiados intentos para este email. Por seguridad, espera un momento.",
        rateLimit: {
          remaining: 0,
          limit: emailLimit.limit,
          reset: emailLimit.reset,
        },
      }
    }

    if (!ipLimit.success) {
      return {
        success: false,
        error: "Demasiados intentos desde esta IP. Intenta más tarde.",
        rateLimit: {
          remaining: 0,
          limit: ipLimit.limit,
          reset: ipLimit.reset,
        },
      }
    }

    // Intentar login con Supabase
    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Si las credenciales son inválidas, devolver info de rate limit
      if (error.message.includes("Invalid login credentials") || error.message.includes("invalid")) {
        return {
          success: false,
          error: "Credenciales inválidas",
          rateLimit: {
            remaining: emailLimit.remaining,
            limit: emailLimit.limit,
            reset: emailLimit.reset,
          },
        }
      }

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

    if (!data?.user || !data?.session) {
      return {
        success: false,
        error: "No se pudo crear la sesión",
      }
    }

    if (!data.session.access_token || !data.session.refresh_token) {
      return {
        success: false,
        error: "No se pudo crear la sesión",
      }
    }

    return {
      success: true,
      redirectTo: "/",
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
    }
  } catch (error) {
    console.error("Error en loginAction:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

export async function signupAction(email: string, password: string, fullName: string): Promise<AuthResult> {
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
