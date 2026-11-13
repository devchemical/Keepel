"use client"

import type { ReactNode } from "react"
import { Layout } from "@/components/layout/Layout"
import { useAuthProjection } from "@/contexts"
import { AUTH_STATE_STATUS } from "@/lib/auth/contracts"

/**
 * The policy is public. Authenticated visitors read it inside the application shell, which already owns the header,
 * navigation and main landmark; everyone else gets the public layout.
 */
export function PrivacyPageLayout({ children }: { children: ReactNode }) {
  const authState = useAuthProjection()

  if (authState.status === AUTH_STATE_STATUS.AUTHENTICATED) {
    return children
  }

  return <Layout>{children}</Layout>
}
