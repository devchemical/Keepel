import { describe, expect, it, vi } from "vitest"
import { runLogoutFormAction } from "@/components/auth/logout-form-action"
import { runPasswordLoginFormAction } from "@/components/auth/password-login-form-action"
import {
  AUTH_INVALIDATION_EVENT,
  createAuthInvalidationCoordinator,
  type AuthInvalidationChannel,
} from "@/lib/auth/auth-invalidation"
import { AUTH_COMMAND_STATUS, AUTH_ERROR_CODE } from "@/lib/auth/contracts"
import { createSessionExpiredRecovery } from "@/lib/auth/session-expiry-recovery"

function createTwoTabChannelHub() {
  const listeners = [new Set<(message: unknown) => void>(), new Set<(message: unknown) => void>()]
  const messages: unknown[] = []

  function createChannel(tabIndex: number): AuthInvalidationChannel {
    return {
      postMessage(message) {
        messages.push(message)

        for (const [index, tabListeners] of listeners.entries()) {
          if (index !== tabIndex) {
            tabListeners.forEach((listener) => listener(message))
          }
        }
      },
      subscribe(listener) {
        listeners[tabIndex].add(listener)

        return () => listeners[tabIndex].delete(listener)
      },
      close() {
        listeners[tabIndex].clear()
      },
    }
  }

  return { createChannel, messages }
}

function createTwoTabs() {
  const hub = createTwoTabChannelHub()
  const senderEvents: string[] = []
  const receiverEvents: string[] = []
  const sender = createAuthInvalidationCoordinator({
    channel: hub.createChannel(0),
    invalidateProjection() {
      senderEvents.push("invalidate")
    },
    refreshNavigation() {
      senderEvents.push("refresh")
    },
  })
  const receiver = createAuthInvalidationCoordinator({
    channel: hub.createChannel(1),
    invalidateProjection() {
      receiverEvents.push("invalidate")
    },
    refreshNavigation() {
      receiverEvents.push("refresh")
    },
  })

  return {
    hub,
    sender,
    senderEvents,
    receiverEvents,
    dispose() {
      sender.dispose()
      receiver.dispose()
    },
  }
}

describe("cross-tab authentication invalidation", () => {
  it("publishes only a semantic event after login and revalidates the receiving tab", async () => {
    const tabs = createTwoTabs()
    const formData = new FormData()
    formData.set("email", "driver@example.com")
    formData.set("password", "secret-password")

    await runPasswordLoginFormAction(null, formData, {
      loginAction: vi.fn(async () => ({
        status: AUTH_COMMAND_STATUS.SUCCESS,
        data: { redirectTo: "/" },
      })),
      onAttempt() {},
      onError() {},
      onSuccess() {
        tabs.sender.invalidate()
      },
    })

    expect(tabs.hub.messages).toEqual([AUTH_INVALIDATION_EVENT])
    expect(Object.keys(tabs.hub.messages[0] as object)).toEqual(["type"])
    expect(JSON.stringify(tabs.hub.messages)).not.toMatch(/user|profile|session|token/i)
    expect(tabs.senderEvents).toEqual(["invalidate"])
    expect(tabs.receiverEvents).toEqual(["invalidate", "refresh"])

    tabs.dispose()
  })

  it("publishes an OAuth callback invalidation without clearing the server-confirmed sender", () => {
    const tabs = createTwoTabs()

    tabs.sender.publish()

    expect(tabs.hub.messages).toEqual([AUTH_INVALIDATION_EVENT])
    expect(tabs.senderEvents).toEqual([])
    expect(tabs.receiverEvents).toEqual(["invalidate", "refresh"])

    tabs.dispose()
  })

  it("invalidates and revalidates a second tab after logout", async () => {
    const tabs = createTwoTabs()

    await runLogoutFormAction(null, new FormData(), {
      logoutAction: vi.fn(async () => ({ status: AUTH_COMMAND_STATUS.SUCCESS, data: null })),
      onAttempt() {},
      onError() {},
      onSuccess() {
        tabs.sender.invalidate()
      },
    })

    expect(tabs.hub.messages).toEqual([AUTH_INVALIDATION_EVENT])
    expect(tabs.senderEvents).toEqual(["invalidate"])
    expect(tabs.receiverEvents).toEqual(["invalidate", "refresh"])

    tabs.dispose()
  })

  it("invalidates and revalidates a second tab after session expiry", () => {
    const tabs = createTwoTabs()
    const recoverSession = createSessionExpiredRecovery({
      invalidateProjection: tabs.sender.invalidate,
      navigate(destination) {
        tabs.senderEvents.push(`navigate:${destination}`)
      },
      refreshNavigation: tabs.sender.revalidate,
    })

    const recovered = recoverSession(
      {
        status: AUTH_COMMAND_STATUS.ERROR,
        error: { code: AUTH_ERROR_CODE.SESSION_EXPIRED },
      },
      "/vehicles/vehicle-1"
    )

    expect(recovered).toBe(true)
    expect(tabs.hub.messages).toEqual([AUTH_INVALIDATION_EVENT])
    expect(tabs.senderEvents).toEqual([
      "invalidate",
      "refresh",
      "navigate:/auth/login?redirect=%2Fvehicles%2Fvehicle-1",
    ])
    expect(tabs.receiverEvents).toEqual(["invalidate", "refresh"])

    tabs.dispose()
  })

  it("revalidates focus and navigation fallbacks without clearing or broadcasting", () => {
    const hub = createTwoTabChannelHub()
    const events: string[] = []
    const tab = createAuthInvalidationCoordinator({
      channel: hub.createChannel(0),
      invalidateProjection() {
        events.push("invalidate")
      },
      refreshNavigation() {
        events.push("refresh")
      },
    })

    tab.revalidate()
    tab.revalidate()

    expect(events).toEqual(["refresh", "refresh"])
    expect(hub.messages).toEqual([])

    tab.dispose()
  })

  it("ignores malformed or payload-bearing messages", () => {
    const hub = createTwoTabChannelHub()
    const senderChannel = hub.createChannel(0)
    const receiverEvents: string[] = []
    const receiver = createAuthInvalidationCoordinator({
      channel: hub.createChannel(1),
      invalidateProjection() {
        receiverEvents.push("invalidate")
      },
      refreshNavigation() {
        receiverEvents.push("refresh")
      },
    })
    const sendUntrustedMessage = senderChannel.postMessage as (message: unknown) => void

    sendUntrustedMessage({ type: AUTH_INVALIDATION_EVENT.type, session: { accessToken: "secret" } })
    sendUntrustedMessage({ type: "AUTH_STATE_CHANGE", state: { user: { email: "driver@example.com" } } })

    expect(receiverEvents).toEqual([])

    senderChannel.close()
    receiver.dispose()
  })
})
