"use client"

import { useEffect } from "react"
import { useAuthProjection } from "@/contexts/AuthProjectionContext"
import { useAnalytics } from "@/hooks/use-analytics"
import { AUTH_STATE_STATUS, type AuthState } from "@/lib/auth/contracts"

interface AuthAnalyticsPort {
  identifyUser(userId: string, properties: { email: string; firstName: string }): void
  resetIdentification(): void
}

export function syncAuthAnalytics(authState: AuthState, analytics: AuthAnalyticsPort) {
  if (authState.status === AUTH_STATE_STATUS.AUTHENTICATED) {
    analytics.identifyUser(authState.user.id, {
      email: authState.user.email ?? "",
      firstName: authState.user.displayName,
    })
    return
  }

  analytics.resetIdentification()
}

export function AuthAnalyticsAdapter() {
  const authState = useAuthProjection()
  const { identifyUser, resetIdentification } = useAnalytics()

  useEffect(() => {
    syncAuthAnalytics(authState, { identifyUser, resetIdentification })
  }, [authState, identifyUser, resetIdentification])

  return null
}
