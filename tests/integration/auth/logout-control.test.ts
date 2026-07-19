import { describe, expect, it, vi } from "vitest"
import { AUTH_COMMAND_STATUS } from "@/lib/auth/contracts"
import { runLogoutFormAction } from "@/components/auth/logout-form-action"

describe("logout control", () => {
  it("invalidates the auth projection and refreshes navigation after the server transition succeeds", async () => {
    const transitionEvents: string[] = []
    const logoutAction = vi.fn(async () => ({
      status: AUTH_COMMAND_STATUS.SUCCESS,
      data: null,
    }))

    const result = await runLogoutFormAction(null, new FormData(), {
      logoutAction,
      onAttempt() {
        transitionEvents.push("attempt")
      },
      onSuccess() {
        transitionEvents.push("invalidate")
        transitionEvents.push("navigate:/auth/login")
        transitionEvents.push("refresh")
      },
      onError() {
        transitionEvents.push("error")
      },
    })

    expect(logoutAction).toHaveBeenCalledOnce()
    expect(result).toEqual({ status: AUTH_COMMAND_STATUS.SUCCESS, data: null })
    expect(transitionEvents).toEqual(["attempt", "invalidate", "navigate:/auth/login", "refresh"])
  })
})
