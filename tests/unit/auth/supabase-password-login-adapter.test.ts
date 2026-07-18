import { describe, expect, it } from "vitest"
import { AUTH_ERROR_CODE } from "@/lib/auth/contracts"
import { mapSupabasePasswordLoginResult } from "@/lib/auth/supabase-password-login-adapter"

describe("Supabase password login adapter", () => {
  it("confirms authentication only when Supabase returns both a user and a session", () => {
    expect(
      mapSupabasePasswordLoginResult({
        data: { user: { id: "user-1" }, session: { access_token: "server-private-token" } },
        error: null,
      })
    ).toEqual({ authenticated: true })

    expect(
      mapSupabasePasswordLoginResult({
        data: { user: { id: "user-1" }, session: null },
        error: null,
      })
    ).toEqual({ authenticated: false, errorCode: AUTH_ERROR_CODE.PROVIDER_ERROR })
  })

  it("preserves the stable provider code without exposing provider messages", () => {
    const result = mapSupabasePasswordLoginResult({
      data: { user: null, session: null },
      error: { code: "invalid_credentials" },
    })

    expect(result).toEqual({ authenticated: false, errorCode: AUTH_ERROR_CODE.INVALID_CREDENTIALS })
    expect(Object.keys(result)).toEqual(["authenticated", "errorCode"])
  })
})
