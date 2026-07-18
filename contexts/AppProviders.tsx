"use client"

import React from "react"
import { Toaster } from "sonner"
import { AuthProvider } from "./AuthContext"
import { AuthProjectionProvider } from "./AuthProjectionContext"
import { DataProvider } from "./DataContext"
import { SupabaseProvider } from "./SupabaseContext"
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
        <SupabaseProvider>
          <AuthProvider>
            <DataProvider>
              {children}
              <Toaster />
            </DataProvider>
          </AuthProvider>
        </SupabaseProvider>
      </AuthProjectionProvider>
    </ContextErrorBoundary>
  )
}
