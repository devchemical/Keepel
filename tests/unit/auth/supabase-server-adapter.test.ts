import { AuthSessionMissingError } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { AUTH_ERROR_CODE } from "@/lib/auth/contracts"
import { mapSupabaseUserResult } from "@/lib/auth/supabase-server-adapter"

describe("Supabase server auth adapter", () => {
  it("treats an empty successful response as an anonymous user", () => {
    const result = mapSupabaseUserResult({
      data: { user: null },
      error: null,
    })

    expect(result).toBeNull()
  })

  it("treats a missing Supabase session as an anonymous user", () => {
    const result = mapSupabaseUserResult({
      data: { user: null },
      error: new AuthSessionMissingError(),
    })

    expect(result).toBeNull()
  })

  it("maps a real Supabase failure to the stable provider error", () => {
    expect(() =>
      mapSupabaseUserResult({
        data: { user: null },
        error: new Error("Supabase is unavailable"),
      })
    ).toThrow(expect.objectContaining({ code: AUTH_ERROR_CODE.PROVIDER_ERROR }))
  })

  it("maps an authenticated Supabase user to the controlled adapter shape", () => {
    const result = mapSupabaseUserResult({
      data: {
        user: {
          id: "user-1",
          email: "driver@example.com",
          user_metadata: { name: "Ada Driver" },
        },
      },
      error: null,
    })

    expect(result).toEqual({
      id: "user-1",
      email: "driver@example.com",
      userMetadata: { name: "Ada Driver" },
    })
  })
})
