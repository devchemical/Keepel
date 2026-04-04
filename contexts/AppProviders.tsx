"use client"

import React from "react"
import { ContextErrorBoundary } from "@/components/ui/context-error-boundary"
import { SupabaseProvider } from "./SupabaseContext"
import { AuthProvider } from "./AuthContext"
import { DataProvider } from "./DataContext"

interface AppProvidersProps {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ContextErrorBoundary>
      <SupabaseProvider>
        <AuthProvider>
          <DataProvider>{children}</DataProvider>
        </AuthProvider>
      </SupabaseProvider>
    </ContextErrorBoundary>
  )
}
