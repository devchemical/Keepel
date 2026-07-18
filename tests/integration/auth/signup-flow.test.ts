import { Buffer } from "node:buffer"
import { createServerClient } from "@supabase/ssr"
import { describe, expect, it, vi } from "vitest"
import { runSignupFormAction } from "@/components/auth/signup-form-action"
import { AUTH_ERROR_CODE, SIGN_UP_STATUS } from "@/lib/auth/contracts"
import { createSignupCommand } from "@/lib/auth/signup"
import { createSupabaseSignupAuthAdapter } from "@/lib/auth/supabase-signup-adapter"

function encodeTokenPart(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function createAccessToken() {
  return `${encodeTokenPart({ alg: "HS256", typ: "JWT" })}.${encodeTokenPart({ sub: "user-1", exp: 4_102_444_800 })}.signature`
}

function createSignupUser() {
  return {
    id: "user-1",
    aud: "authenticated",
    role: "authenticated",
    email: "driver@example.com",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Ada Driver" },
    identities: [],
    created_at: "2026-07-18T00:00:00.000Z",
  }
}

describe("signup flow", () => {
  it("stores an immediate session in SSR cookies and navigates without exposing it to browser code", async () => {
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
              user: createSignupUser(),
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
    const signup = createSignupCommand({
      authAdapter: createSupabaseSignupAuthAdapter(async () => supabase),
      rateLimitAdapter: {
        async isAllowed() {
          return true
        },
      },
    })
    const navigatedTo: string[] = []
    const formData = new FormData()
    formData.set("fullName", "Ada Driver")
    formData.set("email", "driver@example.com")
    formData.set("password", "secret-password")
    formData.set("confirmPassword", "secret-password")

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
      const result = await runSignupFormAction(null, formData, {
        signupAction: async (_previousResult, submittedFormData) =>
          signup({
            email: submittedFormData.get("email"),
            password: submittedFormData.get("password"),
            confirmPassword: submittedFormData.get("confirmPassword"),
            fullName: submittedFormData.get("fullName"),
            clientIp: "203.0.113.10",
            emailRedirectTo: "https://keepel.example/auth/callback",
          }),
        onAuthenticated(destination) {
          navigatedTo.push(destination)
        },
        onConfirmationRequired(destination) {
          navigatedTo.push(destination)
        },
      })

      expect(result).toEqual({
        status: SIGN_UP_STATUS.AUTHENTICATED,
        user: {
          id: "user-1",
          email: "driver@example.com",
          displayName: "Ada Driver",
        },
      })
      expect(JSON.stringify(result)).not.toMatch(/access.?token|refresh.?token|session/i)
      expect(Array.from(serverCookies.keys())).toContainEqual(expect.stringMatching(/^sb-keepel-test-auth-token/))
      expect(navigatedTo).toEqual(["/"])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("navigates to email confirmation when signup does not create a session", async () => {
    const serverCookies = new Map<string, string>()
    const supabase = createServerClient("https://keepel-test.supabase.co", "test-anon-key", {
      global: {
        fetch: async () =>
          new Response(JSON.stringify({ user: createSignupUser() }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
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
    const signup = createSignupCommand({
      authAdapter: createSupabaseSignupAuthAdapter(async () => supabase),
      rateLimitAdapter: {
        async isAllowed() {
          return true
        },
      },
    })
    const navigatedTo: string[] = []
    const formData = new FormData()
    formData.set("fullName", "Ada Driver")
    formData.set("email", "driver@example.com")
    formData.set("password", "secret-password")
    formData.set("confirmPassword", "secret-password")

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
      const result = await runSignupFormAction(null, formData, {
        signupAction: async (_previousResult, submittedFormData) =>
          signup({
            email: submittedFormData.get("email"),
            password: submittedFormData.get("password"),
            confirmPassword: submittedFormData.get("confirmPassword"),
            fullName: submittedFormData.get("fullName"),
            clientIp: "203.0.113.10",
            emailRedirectTo: "https://keepel.example/auth/callback",
          }),
        onAuthenticated(destination) {
          navigatedTo.push(destination)
        },
        onConfirmationRequired(destination) {
          navigatedTo.push(destination)
        },
      })

      expect(result).toEqual({ status: SIGN_UP_STATUS.CONFIRMATION_REQUIRED })
      expect(JSON.stringify(result)).not.toMatch(/access.?token|refresh.?token|session/i)
      expect(navigatedTo).toEqual(["/auth/signup-success"])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("keeps invalid form input on the client-facing form seam", async () => {
    const formData = new FormData()
    formData.set("fullName", "Ada Driver")
    formData.set("email", "driver@example.com")
    formData.set("password", "secret-password")
    formData.set("confirmPassword", "different-password")
    const result = await runSignupFormAction(null, formData, {
      async signupAction() {
        throw new Error("server action should not run")
      },
      onAuthenticated() {},
      onConfirmationRequired() {},
    })

    expect(result).toEqual({
      status: SIGN_UP_STATUS.ERROR,
      error: { code: AUTH_ERROR_CODE.VALIDATION_FAILED },
    })
  })
})
