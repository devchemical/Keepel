"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuthProjectionInvalidation } from "@/contexts"
import type { AuthCommandResult } from "@/lib/auth/contracts"
import { createSessionExpiredRecovery } from "@/lib/auth/session-expiry-recovery"

function readCurrentPath() {
  if (typeof window === "undefined") {
    return "/"
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function useAuthCommandRecovery() {
  const invalidateProjection = useAuthProjectionInvalidation()
  const router = useRouter()

  return useCallback(
    (result: AuthCommandResult<unknown>) =>
      createSessionExpiredRecovery({
        invalidateProjection,
        navigate: router.replace,
        refreshNavigation: router.refresh,
      })(result, readCurrentPath()),
    [invalidateProjection, router]
  )
}
