/* eslint-disable no-console -- OAuth failures need server-side diagnostics until centralized observability is added. */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { OAUTH_ERROR_CODE } from "@/lib/auth/contracts"
import { createOAuthErrorRedirect, sanitizeInternalRedirect } from "@/lib/auth/redirects"
import { createSupabaseGoogleOAuthAdapter, type GoogleOAuthAdapter } from "@/lib/auth/supabase-google-oauth-adapter"
import { createClient } from "@/lib/supabase/server"

type GoogleOAuthAdapterFactory = () => GoogleOAuthAdapter | Promise<GoogleOAuthAdapter>

export function createGoogleOAuthHandler(createAdapter: GoogleOAuthAdapterFactory) {
  return async function handleGoogleOAuth(request: NextRequest) {
    try {
      const callbackUrl = new URL("/auth/callback", request.url)
      callbackUrl.searchParams.set("next", sanitizeInternalRedirect(request.nextUrl.searchParams.get("redirectTo")))

      const adapter = await createAdapter()
      const oauthStartResult = await adapter.createAuthorizationUrl(callbackUrl.toString())

      return oauthStartResult.started
        ? NextResponse.redirect(oauthStartResult.authorizationUrl)
        : NextResponse.redirect(createOAuthErrorRedirect(request.nextUrl.origin, oauthStartResult.errorCode))
    } catch (error) {
      console.error("Unexpected Google OAuth initiation failure:", error)
      return NextResponse.redirect(createOAuthErrorRedirect(request.nextUrl.origin, OAUTH_ERROR_CODE.UNEXPECTED))
    }
  }
}

export const GET = createGoogleOAuthHandler(() =>
  createSupabaseGoogleOAuthAdapter(createClient, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
)
