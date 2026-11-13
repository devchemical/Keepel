"use client"

import React from "react"
import { Toaster } from "sonner"
import { AuthProjectionProvider, AuthProjectionSynchronization } from "./AuthProjectionContext"
import { DataProvider } from "./DataContext"
import { SupabaseProvider } from "./SupabaseContext"
import { ConsentProvider } from "@/components/privacy/consent-provider"
import { ContextErrorBoundary } from "@/components/ui/context-error-boundary"
import { AuthenticatedApplicationBoundary } from "@/components/layout/authenticated-application-shell"
import type { AuthState } from "@/lib/auth/contracts"
import type { PrivacyConsentState } from "@/lib/privacy/consent"

interface AppProvidersProps {
  children: React.ReactNode
  initialAuthState: AuthState
  initialPrivacyConsent: PrivacyConsentState
}

export function AppProviders({ children, initialAuthState, initialPrivacyConsent }: AppProvidersProps) {
  return (
    <ContextErrorBoundary>
      <ConsentProvider initialConsent={initialPrivacyConsent}>
        <AuthProjectionProvider initialState={initialAuthState}>
          <AuthProjectionSynchronization>
            <SupabaseProvider>
              <DataProvider>
                <AuthenticatedApplicationBoundary>{children}</AuthenticatedApplicationBoundary>
                <Toaster />
              </DataProvider>
            </SupabaseProvider>
          </AuthProjectionSynchronization>
        </AuthProjectionProvider>
      </ConsentProvider>
    </ContextErrorBoundary>
  )
}
