import { describe, expect, it, vi } from "vitest"
import { AUTH_COMMAND_STATUS, AUTH_ERROR_CODE } from "@/lib/auth/contracts"
import { createLogoutCommand } from "@/lib/auth/logout"
import { createAuthServerApi } from "@/lib/auth/server-boundary"
import { createSupabaseLogoutAuthAdapter } from "@/lib/auth/supabase-logout-adapter"
import { createControlledAuthServerAdapter } from "@/tests/support/controlled-auth-server-adapter"

describe("logout flow", () => {
  it("destroys only the server-side local session without accessing browser auth storage", async () => {
    const receivedOptions: unknown[] = []
    const privateAuth = createAuthServerApi(
      createControlledAuthServerAdapter({ id: "user-1", email: "driver@example.com" })
    )
    const logout = createLogoutCommand({
      requireCurrentUser: privateAuth.requireCurrentUser,
      authAdapter: createSupabaseLogoutAuthAdapter(async () => ({
        auth: {
          async signOut(options) {
            receivedOptions.push(options)
            return { error: null }
          },
        },
      })),
    })
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
      const result = await logout()

      expect(receivedOptions).toEqual([{ scope: "local" }])
      expect(result).toEqual({ status: AUTH_COMMAND_STATUS.SUCCESS, data: null })
      expect(JSON.stringify(result)).not.toMatch(/access.?token|refresh.?token|session/i)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("returns session expired without contacting logout when the private user is missing", async () => {
    const privateAuth = createAuthServerApi(createControlledAuthServerAdapter(null))
    const signOut = vi.fn(async () => ({ error: null }))
    const logout = createLogoutCommand({
      requireCurrentUser: privateAuth.requireCurrentUser,
      authAdapter: createSupabaseLogoutAuthAdapter(async () => ({ auth: { signOut } })),
    })

    const result = await logout()

    expect(signOut).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: AUTH_COMMAND_STATUS.ERROR,
      error: { code: AUTH_ERROR_CODE.SESSION_EXPIRED },
    })
  })
})
