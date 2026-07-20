/* eslint-disable unicorn/require-post-message-target-origin -- BroadcastChannel messages stay within the named same-origin channel. */

export const AUTH_INVALIDATION_EVENT = Object.freeze({ type: "auth-invalidated" as const })
export const AUTH_INVALIDATION_CHANNEL_NAME = "keepel-auth-invalidation"
export const AUTH_INVALIDATION_SEARCH_PARAM = "keepel-auth-invalidated"

export interface AuthInvalidationChannel {
  postMessage(message: typeof AUTH_INVALIDATION_EVENT): void
  subscribe(listener: (message: unknown) => void): () => void
  close(): void
}

export function createBrowserAuthInvalidationChannel(): AuthInvalidationChannel | null {
  if (typeof window === "undefined" || typeof window.BroadcastChannel !== "function") {
    return null
  }

  let channel: BroadcastChannel

  try {
    channel = new window.BroadcastChannel(AUTH_INVALIDATION_CHANNEL_NAME)
  } catch {
    return null
  }

  return {
    postMessage(message) {
      channel.postMessage(message)
    },
    subscribe(listener) {
      const handleMessage = (event: MessageEvent<unknown>) => listener(event.data)
      channel.addEventListener("message", handleMessage)

      return () => channel.removeEventListener("message", handleMessage)
    },
    close() {
      channel.close()
    },
  }
}

interface AuthInvalidationCoordinatorDependencies {
  channel: AuthInvalidationChannel | null
  invalidateProjection(): void
  refreshNavigation(): void
}

function isAuthInvalidationEvent(message: unknown): message is typeof AUTH_INVALIDATION_EVENT {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return false
  }

  const record = message as Record<string, unknown>

  return Object.keys(record).length === 1 && record.type === AUTH_INVALIDATION_EVENT.type
}

export function createAuthInvalidationCoordinator({
  channel,
  invalidateProjection,
  refreshNavigation,
}: AuthInvalidationCoordinatorDependencies) {
  const unsubscribe = channel?.subscribe((message) => {
    if (!isAuthInvalidationEvent(message)) {
      return
    }

    invalidateProjection()
    refreshNavigation()
  })

  return {
    publish() {
      channel?.postMessage(AUTH_INVALIDATION_EVENT)
    },
    invalidate() {
      invalidateProjection()
      channel?.postMessage(AUTH_INVALIDATION_EVENT)
    },
    revalidate() {
      refreshNavigation()
    },
    dispose() {
      unsubscribe?.()
      channel?.close()
    },
  }
}
