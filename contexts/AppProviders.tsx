"use client"

import React from "react"
import { Toaster } from "sonner"
import { AuthProjectionProvider, AuthProjectionSynchronization } from "./AuthProjectionContext"
import { DataProvider } from "./DataContext"
import { SupabaseProvider } from "./SupabaseContext"
import { AuthAnalyticsAdapter } from "@/components/analytics/auth-analytics-adapter"
import { ContextErrorBoundary } from "@/components/ui/context-error-boundary"
import type { AuthState } from "@/lib/auth/contracts"

interface AppProvidersProps {
  children: React.ReactNode
  initialAuthState: AuthState
}

export function AppProviders({ children, initialAuthState }: AppProvidersProps) {
  return (
    <ContextErrorBoundary>
      <AuthProjectionProvider initialState={initialAuthState}>
        <AuthProjectionSynchronization>
          <AuthAnalyticsAdapter />
          <SupabaseProvider>
            <DataProvider>
              {children}
              <Toaster />
            </DataProvider>
          </SupabaseProvider>
        </AuthProjectionSynchronization>
      </AuthProjectionProvider>
    </ContextErrorBoundary>
  )
}
