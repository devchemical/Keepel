"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { AUTH_STATE_STATUS, type AuthState } from "@/lib/auth/contracts"

const AuthProjectionContext = createContext<AuthState | null>(null)
const AuthProjectionInvalidationContext = createContext<(() => void) | null>(null)

interface AuthProjectionProviderProps {
  children?: ReactNode
  initialState: AuthState
}

export function AuthProjectionProvider({ children, initialState }: AuthProjectionProviderProps) {
  const [state, setState] = useState(initialState)

  useEffect(() => {
    setState(initialState)
  }, [initialState])

  const invalidate = useCallback(() => {
    setState({ status: AUTH_STATE_STATUS.ANONYMOUS, user: null })
  }, [])

  return (
    <AuthProjectionInvalidationContext.Provider value={invalidate}>
      <AuthProjectionContext.Provider value={state}>{children}</AuthProjectionContext.Provider>
    </AuthProjectionInvalidationContext.Provider>
  )
}

export function useAuthProjection() {
  const state = useContext(AuthProjectionContext)

  if (!state) {
    throw new Error("useAuthProjection must be used within an AuthProjectionProvider")
  }

  return state
}

export function useAuthProjectionInvalidation() {
  const invalidate = useContext(AuthProjectionInvalidationContext)

  if (!invalidate) {
    throw new Error("useAuthProjectionInvalidation must be used within an AuthProjectionProvider")
  }

  return invalidate
}
