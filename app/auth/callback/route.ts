/* eslint-disable no-console -- Callback failures need server-side diagnostics until centralized observability is added. */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { sanitizeInternalRedirect } from "@/lib/auth/redirects"
import { createClient } from "@/lib/supabase/server"

export interface AuthCallbackExchangeResult {
  data: { user: unknown | null } | null
  error: { message: string } | null
}

export interface AuthCallbackAdapter {
  exchangeCodeForSession(code: string): Promise<AuthCallbackExchangeResult>
}

type AuthCallbackAdapterFactory = () => Promise<AuthCallbackAdapter>

export function createAuthCallbackHandler(createAdapter: AuthCallbackAdapterFactory) {
  return async function handleAuthCallback(request: NextRequest) {
    try {
      const { searchParams, origin } = new URL(request.url)
      const code = searchParams.get("code")
      const error = searchParams.get("error")
      const next = sanitizeInternalRedirect(searchParams.get("next"))

      // Si hay un error de OAuth
      if (error) {
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(error)}`)
      }

      // Si no hay código, redirigir a error
      if (!code) {
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("No authorization code")}`)
      }

      // Intentar intercambiar el código por una sesión
      const adapter = await createAdapter()
      const { data, error: exchangeError } = await adapter.exchangeCodeForSession(code)

      if (exchangeError) {
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent(exchangeError.message)}`)
      }

      if (!data?.user) {
        return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("No user found")}`)
      }

      // Éxito - redirigir al destino
      return NextResponse.redirect(new URL(next, origin))
    } catch (error) {
      console.error("Auth callback error:", error)
      const { origin } = new URL(request.url)
      return NextResponse.redirect(`${origin}/auth/error?message=${encodeURIComponent("Callback failed")}`)
    }
  }
}

export const GET = createAuthCallbackHandler(async () => {
  const supabase = await createClient()

  return {
    exchangeCodeForSession(code) {
      return supabase.auth.exchangeCodeForSession(code)
    },
  }
})
