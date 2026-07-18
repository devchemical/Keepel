import { Buffer } from "node:buffer"
import { createServerClient } from "@supabase/ssr"
import { describe, expect, it, vi } from "vitest"
import { runPasswordLoginFormAction } from "@/components/auth/password-login-form-action"
import { AUTH_COMMAND_STATUS } from "@/lib/auth/contracts"
import { createPasswordLoginCommand } from "@/lib/auth/password-login"
import { createSupabasePasswordLoginAuthAdapter } from "@/lib/auth/supabase-password-login-adapter"

function encodeTokenPart(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function createAccessToken() {
  return `${encodeTokenPart({ alg: "HS256", typ: "JWT" })}.${encodeTokenPart({ sub: "user-1", exp: 4_102_444_800 })}.signature`
}

describe("password login flow", () => {
  it("creates SSR cookies and navigates without giving browser code session access", async () => {
    const serverCookies = new Map<string, string>()
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
                app_metadata: { provider: "email", providers: ["email"] },
                user_metadata: {},
                identities: [],
                created_at: "2026-07-18T00:00:00.000Z",
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          ),
      },
      cookies: {
        getAll() {
          return Array.from(serverCookies, ([name, value]) => ({ name, value }))
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            serverCookies.set(name, value)
          }
        },
      },
    })
    await supabase.auth.getSession()
    const login = createPasswordLoginCommand({
      authAdapter: createSupabasePasswordLoginAuthAdapter(async () => supabase),
      rateLimitAdapter: {
        async isAllowed() {
          return true
        },
      },
    })
    const navigatedTo: string[] = []
    const formData = new FormData()
    formData.set("email", "driver@example.com")
    formData.set("password", "secret-password")
    formData.set("redirectTo", "https://evil.example/phishing")

    const forbiddenBrowserSessionAccess = new Proxy(
      {},
      {
        get() {
          throw new Error("browser session data must not be read or written")
        },
        ownKeys() {
          throw new Error("browser session data must not be enumerated")
        },
      }
    )
    vi.stubGlobal("window", forbiddenBrowserSessionAccess)
    vi.stubGlobal("document", forbiddenBrowserSessionAccess)
    vi.stubGlobal("localStorage", forbiddenBrowserSessionAccess)
    vi.stubGlobal("sessionStorage", forbiddenBrowserSessionAccess)

    try {
      const result = await runPasswordLoginFormAction(null, formData, {
        loginAction: async (_previousResult, submittedFormData) =>
          login({
            email: submittedFormData.get("email"),
            password: submittedFormData.get("password"),
            clientIp: "203.0.113.10",
            redirectTo: submittedFormData.get("redirectTo"),
          }),
        onAttempt() {},
        onError() {},
        onSuccess(destination) {
          navigatedTo.push(destination)
        },
      })

      expect(result).toEqual({ status: AUTH_COMMAND_STATUS.SUCCESS, data: { redirectTo: "/" } })
      expect(Object.keys(result.status === AUTH_COMMAND_STATUS.SUCCESS ? result.data : {})).toEqual(["redirectTo"])
      expect(JSON.stringify(result)).not.toMatch(/access.?token|refresh.?token|session/i)
      expect(Array.from(serverCookies.keys())).toEqual([expect.stringMatching(/^sb-keepel-test-auth-token/)])
      expect(navigatedTo).toEqual(["/"])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
