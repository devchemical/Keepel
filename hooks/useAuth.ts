"use client"

/* eslint-disable no-console -- Auth hook logs failures until centralized observability is added. */

import { useState, useEffect } from "react"
import { useSupabase } from "@/hooks/useSupabase"

interface AuthUser {
  id: string
  email?: string
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth(): AuthState & {
  signOut: () => Promise<void>
} {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useSupabase()

  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        setIsLoading(true)

        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser()

        if (!isMounted) return

        if (authError) {
          console.error("Auth error:", authError)
          setUser(null)
          setIsLoading(false)
          return
        }

        if (authUser) {
          setUser({ id: authUser.id, email: authUser.email })
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
        setUser(null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    // Timeout de seguridad para evitar loading infinito
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false)
      }
    }, 5000) // 5 segundos

    const initTimeout = setTimeout(() => {
      initAuth()
    }, 100)

    // Auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return

      if (event === "SIGNED_IN" && session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
      } else if (event === "SIGNED_OUT") {
        setUser(null)
      }
    })

    return () => {
      isMounted = false
      clearTimeout(initTimeout)
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    try {
      // 1. Clear local state
      setUser(null)

      // 2. Call server-side logout API to clear HTTP-only cookies
      const response = await fetch("/api/auth/signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        console.error("Server logout failed:", response.status)
      }

      // 3. Also call client-side signOut
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Client signOut error:", error)
      }

      // 4. Wait for server to process
      await new Promise((resolve) => setTimeout(resolve, 300))

      // 5. Hard redirect
      if (typeof window !== "undefined") {
        window.location.href = "/"
      }
    } catch (error) {
      console.error("Error during sign out:", error)
      setUser(null)
      if (typeof window !== "undefined") {
        window.location.href = "/"
      }
    }
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signOut,
  }
}
