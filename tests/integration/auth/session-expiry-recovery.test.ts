import { describe, expect, it, vi } from "vitest"
import { AUTH_COMMAND_STATUS, AUTH_ERROR_CODE } from "@/lib/auth/contracts"
import { createPrivateAuthCommand } from "@/lib/auth/private-command"
import { createSessionExpiredRecovery } from "@/lib/auth/session-expiry-recovery"
import { createAuthServerApi } from "@/lib/auth/server-boundary"
import { createControlledAuthServerAdapter } from "@/tests/support/controlled-auth-server-adapter"

describe("session expiry recovery", () => {
  it("maps a missing private user to session expiry and recovers through the sanitized login path", async () => {
    const privateAuth = createAuthServerApi(createControlledAuthServerAdapter(null))
    const execute = vi.fn(async () => ({
      status: AUTH_COMMAND_STATUS.SUCCESS,
      data: { vehicleId: "vehicle-1" },
    }))
    const privateCommand = createPrivateAuthCommand({
      requireCurrentUser: privateAuth.requireCurrentUser,
      execute,
    })
    const recoveryEvents: string[] = []
    const recoverSession = createSessionExpiredRecovery({
      invalidateProjection() {
        recoveryEvents.push("invalidate")
      },
      navigate(destination) {
        recoveryEvents.push(`navigate:${destination}`)
      },
      refreshNavigation() {
        recoveryEvents.push("refresh")
      },
    })

    const result = await privateCommand({ vehicleId: "vehicle-1" })
    const recovered = recoverSession(result, "https://evil.example/phishing")

    expect(execute).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: AUTH_COMMAND_STATUS.ERROR,
      error: { code: AUTH_ERROR_CODE.SESSION_EXPIRED },
    })
    expect(recovered).toBe(true)
    expect(recoveryEvents).toEqual(["invalidate", "navigate:/auth/login?redirect=%2F", "refresh"])
  })
})
