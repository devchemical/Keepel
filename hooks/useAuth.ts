"use client"

/* eslint-disable no-console -- Auth hook logs failures until centralized observability is added. */

import { useState, useEffect, useCallback } from "react"
import { useSupabase } from "@/hooks/useSupabase"

interface AuthUser {
  id: string
  email?: string
}

interface Profile {
  id: string
  full_name?: string
  email: string
}

interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth(): AuthState & {
  signOut: () => Promise<void>
} {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useSupabase()

  const loadProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

        if (error && error.code !== "PGRST116") {
          console.error("Profile error:", error)
        } else if (data) {
          setProfile(data)
        }
      } catch (error) {
        console.error("Profile load error:", error)
      }
    },
    [supabase]
  )

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
          setProfile(null)
          setIsLoading(false)
          return
        }

        if (authUser) {
          setUser({ id: authUser.id, email: authUser.email })

          // Crear perfil básico
          const basicProfile = {
            id: authUser.id,
            email: authUser.email || "",
            full_name:
              authUser.user_metadata?.name ||
              authUser.user_metadata?.full_name ||
              authUser.email?.split("@")[0] ||
              "Usuario",
          }
          setProfile(basicProfile)

          // Intentar cargar perfil de la base de datos
          await loadProfile(authUser.id)
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
        setUser(null)
        setProfile(null)
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

        const basicProfile = {
          id: session.user.id,
          email: session.user.email || "",
          full_name:
            session.user.user_metadata?.name ||
            session.user.user_metadata?.full_name ||
            session.user.email?.split("@")[0] ||
            "Usuario",
        }
        setProfile(basicProfile)

        await loadProfile(session.user.id)
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      isMounted = false
      clearTimeout(initTimeout)
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [supabase, loadProfile])

  const signOut = async () => {
    try {
      // 1. Clear local state
      setUser(null)
      setProfile(null)

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
      setProfile(null)
      if (typeof window !== "undefined") {
        window.location.href = "/"
      }
    }
  }

  return {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    signOut,
  }
}
