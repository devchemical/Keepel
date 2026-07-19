"use client"

/* eslint-disable no-console, react/jsx-no-constructed-context-values -- Auth failures are logged for diagnostics; context value memoization is deferred to avoid changing auth behavior. */

import React, { createContext, useContext, useEffect, useState } from "react"
import { authManager } from "@/lib/auth/authManager"

export interface AuthUser {
  id: string
  email?: string
}

export interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isLoggingOut: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    // Suscribirse a cambios de estado del AuthManager
    const unsubscribe = authManager.subscribe((state) => {
      setIsLoading(state.isLoading)

      if (state.user) {
        setUser({
          id: state.user.id,
          email: state.user.email,
        })
      } else {
        setUser(null)
      }
    })

    // Cleanup
    return () => {
      unsubscribe()
    }
  }, [])

  const signOut = async () => {
    // Prevenir múltiples intentos simultáneos
    if (isLoggingOut) return

    try {
      setIsLoggingOut(true)

      // Usar AuthManager para cerrar sesión
      await authManager.signOut()

      // Redirigir al login
      if (typeof window !== "undefined") {
        window.location.href = `/auth/login?logout=${Date.now()}`
      }
    } catch (error) {
      console.error("Error durante sign out:", error)

      // Forzar redirección incluso si hay error
      if (typeof window !== "undefined") {
        window.location.href = `/auth/login?logout=${Date.now()}`
      }
    }
  }

  const value: AuthContextValue = {
    user,
    isLoading,
    isLoggingOut,
    isAuthenticated: !!user,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
