import { NextRequest } from "next/server"
import type { CookieOptions } from "@supabase/ssr"
import { AuthSessionMissingError } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { AUTH_ERROR_CODE } from "@/lib/auth/contracts"
import { createAuthServerApi } from "@/lib/auth/server-boundary"
import { createAuthProxy } from "@/lib/supabase/proxy"
import { createControlledAuthServerAdapter } from "@/tests/support/controlled-auth-server-adapter"

interface ControlledAuthProxyOptions {
  claimsResult: unknown
  cookiesToSet?: Array<{
    name: string
    value: string
    options: CookieOptions
  }>
}

function createControlledAuthProxy({ claimsResult, cookiesToSet = [] }: ControlledAuthProxyOptions) {
  return createAuthProxy(() => ({
    async getClaims() {
      return claimsResult
    },
    getCookiesToSet() {
      return cookiesToSet
    },
  }))
}

describe("authentication proxy", () => {
  it("allows an authenticated protected request and forwards refreshed SSR cookies", async () => {
    const proxy = createControlledAuthProxy({
      claimsResult: {
        data: { claims: { sub: "user-1" } },
        error: null,
      },
      cookiesToSet: [
        {
          name: "sb-keepel-auth-token",
          value: "refreshed-cookie",
          options: { httpOnly: true, sameSite: "lax" },
        },
      ],
    })

    const response = await proxy(new NextRequest("https://keepel.test/vehicles/vehicle-1?tab=maintenance"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(response.cookies.get("sb-keepel-auth-token")?.value).toBe("refreshed-cookie")
    expect(response.headers.get("set-cookie")).toContain("HttpOnly")
  })

  it("redirects an anonymous protected request to login with a sanitized return destination", async () => {
    const proxy = createControlledAuthProxy({
      claimsResult: { data: null, error: null },
      cookiesToSet: [
        {
          name: "sb-keepel-auth-token",
          value: "refreshed-anonymous-cookie",
          options: { httpOnly: true },
        },
      ],
    })

    const response = await proxy(new NextRequest("https://keepel.test/vehicles/vehicle-1?tab=maintenance"))
    const location = new URL(response.headers.get("location") ?? "")

    expect(response.status).toBe(307)
    expect(location.origin).toBe("https://keepel.test")
    expect(location.pathname).toBe("/auth/login")
    expect(location.searchParams.get("redirect")).toBe("/vehicles/vehicle-1?tab=maintenance")
    expect(response.cookies.get("sb-keepel-auth-token")?.value).toBe("refreshed-anonymous-cookie")
  })

  it.each([
    ["/auth/login?redirect=%2Fvehicles%3Ffilter%3Ddue", "/vehicles?filter=due"],
    ["/auth/login?redirect=https%3A%2F%2Fevil.example", "/"],
  ])("redirects an authenticated guest-only request to a sanitized destination", async (path, expectedPath) => {
    const proxy = createControlledAuthProxy({
      claimsResult: {
        data: { claims: { sub: "user-1" } },
        error: null,
      },
    })

    const response = await proxy(new NextRequest(`https://keepel.test${path}`))
    const location = new URL(response.headers.get("location") ?? "")

    expect(response.status).toBe(307)
    expect(`${location.pathname}${location.search}`).toBe(expectedPath)
  })

  it("allows a guest-only request with no session and forwards cleared SSR cookies", async () => {
    const proxy = createControlledAuthProxy({
      claimsResult: {
        data: null,
        error: new AuthSessionMissingError(),
      },
      cookiesToSet: [
        {
          name: "sb-keepel-auth-token",
          value: "",
          options: { maxAge: 0 },
        },
      ],
    })

    const response = await proxy(new NextRequest("https://keepel.test/auth/login"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
    expect(response.cookies.get("sb-keepel-auth-token")?.value).toBe("")
  })

  it("requires a fresh Auth user for private operations even when navigation claims remain valid", async () => {
    const proxy = createControlledAuthProxy({
      claimsResult: {
        data: { claims: { sub: "revoked-user" } },
        error: null,
      },
    })
    const privateAuth = createAuthServerApi(createControlledAuthServerAdapter(null))

    const navigationResponse = await proxy(new NextRequest("https://keepel.test/vehicles"))

    expect(navigationResponse.status).toBe(200)
    await expect(privateAuth.requireCurrentUser()).rejects.toMatchObject({
      code: AUTH_ERROR_CODE.AUTHENTICATION_REQUIRED,
    })
  })
})
