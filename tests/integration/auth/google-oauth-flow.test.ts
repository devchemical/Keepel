import { NextRequest } from "next/server"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Buffer } from "node:buffer"
import { createServerClient } from "@supabase/ssr"
import { describe, expect, it } from "vitest"
import { createAuthCallbackHandler } from "@/app/auth/callback/route"
import { createGoogleOAuthHandler } from "@/app/auth/google/route"
import { GoogleSignInButton } from "@/components/auth/google-signin-button"
import { OAUTH_ERROR_CODE } from "@/lib/auth/contracts"
import { createSupabaseGoogleOAuthAdapter } from "@/lib/auth/supabase-google-oauth-adapter"

function encodeTokenPart(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function createAccessToken() {
  return `${encodeTokenPart({ alg: "HS256", typ: "JWT" })}.${encodeTokenPart({ sub: "user-1", exp: 4_102_444_800 })}.signature`
}

function createTestCookieStore() {
  const values = new Map<string, string>()

  return {
    values,
    cookies: {
      getAll() {
        return Array.from(values, ([name, value]) => ({ name, value }))
      },
      setAll(cookiesToSet: Array<{ name: string; value: string }>) {
        for (const { name, value } of cookiesToSet) {
          values.set(name, value)
        }
      },
    },
  }
}

describe("Google OAuth flow", () => {
  it("starts Google OAuth on the server with a PKCE cookie and a sanitized callback destination", async () => {
    const serverCookies = createTestCookieStore()
    const supabase = createServerClient("https://keepel-test.supabase.co", "test-anon-key", {
      cookies: serverCookies.cookies,
    })
    const handleGoogleOAuth = createGoogleOAuthHandler(async () =>
      createSupabaseGoogleOAuthAdapter(async () => supabase, "https://keepel-test.supabase.co")
    )
    const request = new NextRequest(
      "https://keepel.example/auth/google?redirectTo=https%3A%2F%2Fevil.example%2Fphishing"
    )

    const response = await handleGoogleOAuth(request)

    const authorizationUrl = new URL(response.headers.get("location") ?? "")
    expect(authorizationUrl.origin).toBe("https://keepel-test.supabase.co")
    expect(authorizationUrl.pathname).toBe("/auth/v1/authorize")
    expect(authorizationUrl.searchParams.get("provider")).toBe("google")
    expect(authorizationUrl.searchParams.get("redirect_to")).toBe("https://keepel.example/auth/callback?next=%2F")
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("s256")
    expect(authorizationUrl.searchParams.get("code_challenge")).toEqual(expect.any(String))
    expect(Array.from(serverCookies.values.keys())).toEqual([
      expect.stringMatching(/^sb-keepel-test-auth-token-code-verifier/),
    ])
    expect(await response.text()).toBe("")
  })

  it("renders a server initiation link instead of a browser auth control", () => {
    const markup = renderToStaticMarkup(
      createElement(GoogleSignInButton, {
        redirectTo: "/vehicles/vehicle-1?tab=maintenance#record-42",
      })
    )

    expect(markup).toContain('href="/auth/google?redirectTo=%2Fvehicles%2Fvehicle-1%3Ftab%3Dmaintenance%23record-42"')
    expect(markup).not.toContain('type="button"')
  })

  it("rejects an authorization URL outside the configured Supabase origin", async () => {
    const adapter = createSupabaseGoogleOAuthAdapter(
      async () => ({
        auth: {
          async signInWithOAuth() {
            return {
              data: { provider: "google", url: "https://evil.example/auth/v1/authorize?provider=google" },
              error: null,
            }
          },
        },
      }),
      "https://keepel-test.supabase.co"
    )

    const oauthStartResult = await adapter.createAuthorizationUrl("https://keepel.example/auth/callback")

    expect(oauthStartResult).toEqual({ started: false, errorCode: OAUTH_ERROR_CODE.PROVIDER_ERROR })
  })

  it("exchanges the callback code on the server and stores the session in SSR cookies", async () => {
    const serverCookies = createTestCookieStore()
    const supabase = createServerClient("https://keepel-test.supabase.co", "test-anon-key", {
      global: {
        fetch: async () =>
          new Response(
            JSON.stringify({
              access_token: createAccessToken(),
              refresh_token: "server-refresh-token",
              expires_in: 3600,
              token_type: "bearer",
              user: {
                id: "user-1",
                aud: "authenticated",
                role: "authenticated",
                email: "driver@example.com",
                app_metadata: { provider: "google", providers: ["google"] },
                user_metadata: {},
                identities: [],
                created_at: "2026-07-19T00:00:00.000Z",
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          ),
      },
      cookies: serverCookies.cookies,
    })
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://keepel.example/auth/callback?next=%2Fvehicles" },
    })
    const handleCallback = createAuthCallbackHandler(async () => ({
      exchangeCodeForSession(code) {
        return supabase.auth.exchangeCodeForSession(code)
      },
    }))
    const request = new NextRequest(
      "https://keepel.example/auth/callback?code=valid-code&next=%2Fvehicles%3Ffilter%3Ddue"
    )

    const response = await handleCallback(request)

    expect(response.headers.get("location")).toBe("https://keepel.example/vehicles?filter=due")
    expect(Array.from(serverCookies.values.keys())).toContainEqual(expect.stringMatching(/^sb-keepel-test-auth-token$/))
    expect(response.headers.get("location")).not.toMatch(/access.?token|refresh.?token|session/i)
    expect(await response.text()).toBe("")
  })
})
