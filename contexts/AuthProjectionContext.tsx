"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { AuthState } from "@/lib/auth/contracts"

const AuthProjectionContext = createContext<AuthState | null>(null)

interface AuthProjectionProviderProps {
  children?: ReactNode
  initialState: AuthState
}

export function AuthProjectionProvider({ children, initialState }: AuthProjectionProviderProps) {
  return <AuthProjectionContext.Provider value={initialState}>{children}</AuthProjectionContext.Provider>
}

export function useAuthProjection() {
  const state = useContext(AuthProjectionContext)

  if (!state) {
    throw new Error("useAuthProjection must be used within an AuthProjectionProvider")
  }

  return state
}
