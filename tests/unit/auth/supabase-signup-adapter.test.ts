import { describe, expect, it } from "vitest"
import { AUTH_ERROR_CODE, SIGN_UP_STATUS } from "@/lib/auth/contracts"
import { createSupabaseSignupAuthAdapter, mapSupabaseSignupResult } from "@/lib/auth/supabase-signup-adapter"

describe("Supabase signup adapter", () => {
  it("projects an immediate session to a public user without session data", () => {
    const result = mapSupabaseSignupResult({
      data: {
        user: {
          id: "user-1",
          email: "driver@example.com",
          user_metadata: { full_name: "Ada Driver" },
        },
        session: {
          access_token: "server-access-token",
          refresh_token: "server-refresh-token",
        },
      },
      error: null,
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
  })

  it("distinguishes signup that requires email confirmation", () => {
    const result = mapSupabaseSignupResult({
      data: {
        user: {
          id: "user-1",
          email: "driver@example.com",
          user_metadata: { full_name: "Ada Driver" },
        },
        session: null,
      },
      error: null,
    })

    expect(result).toEqual({ status: SIGN_UP_STATUS.CONFIRMATION_REQUIRED })
  })

  it("returns only Keepel's stable code for provider failures", async () => {
    const adapter = createSupabaseSignupAuthAdapter(async () => ({
      auth: {
        async signUp() {
          return {
            data: { user: null, session: null },
            error: { code: "user_already_exists", message: "User already registered" },
          }
        },
      },
    }))

    const result = await adapter.signUp({
      email: "driver@example.com",
      password: "secret-password",
      fullName: "Ada Driver",
      emailRedirectTo: "https://keepel.example/auth/callback",
    })

    expect(result).toEqual({
      status: SIGN_UP_STATUS.ERROR,
      error: { code: AUTH_ERROR_CODE.PROVIDER_ERROR },
    })
    expect(Object.keys(result.status === SIGN_UP_STATUS.ERROR ? result.error : {})).toEqual(["code"])
  })
})
