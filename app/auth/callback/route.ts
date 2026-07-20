/* eslint-disable no-console -- Callback failures need server-side diagnostics until centralized observability is added. */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { AUTH_INVALIDATION_SEARCH_PARAM } from "@/lib/auth/auth-invalidation"
import { OAUTH_ERROR_CODE } from "@/lib/auth/contracts"
import { createOAuthErrorRedirect, sanitizeInternalRedirect } from "@/lib/auth/redirects"
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
      const providerError = searchParams.get("error")
      const next = sanitizeInternalRedirect(searchParams.get("next"))

      if (providerError) {
        const errorCode =
          providerError === "access_denied" ? OAUTH_ERROR_CODE.CANCELLED : OAUTH_ERROR_CODE.PROVIDER_ERROR
        return NextResponse.redirect(createOAuthErrorRedirect(origin, errorCode))
      }

      if (!code) {
        return NextResponse.redirect(createOAuthErrorRedirect(origin, OAUTH_ERROR_CODE.PROVIDER_ERROR))
      }

      const adapter = await createAdapter()
      const { data, error: exchangeError } = await adapter.exchangeCodeForSession(code)

      if (exchangeError) {
        return NextResponse.redirect(createOAuthErrorRedirect(origin, OAUTH_ERROR_CODE.PROVIDER_ERROR))
      }

      if (!data?.user) {
        return NextResponse.redirect(createOAuthErrorRedirect(origin, OAUTH_ERROR_CODE.PROVIDER_ERROR))
      }

      const destination = new URL(next, origin)
      destination.searchParams.set(AUTH_INVALIDATION_SEARCH_PARAM, "1")

      return NextResponse.redirect(destination)
    } catch (error) {
      console.error("Auth callback error:", error)
      const { origin } = new URL(request.url)
      return NextResponse.redirect(createOAuthErrorRedirect(origin, OAUTH_ERROR_CODE.UNEXPECTED))
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
