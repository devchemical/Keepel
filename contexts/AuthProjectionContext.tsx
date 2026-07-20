"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  AUTH_INVALIDATION_SEARCH_PARAM,
  createAuthInvalidationCoordinator,
  createBrowserAuthInvalidationChannel,
} from "@/lib/auth/auth-invalidation"
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

export function AuthProjectionSynchronization({ children }: { children?: ReactNode }) {
  const invalidateLocalProjection = useAuthProjectionInvalidation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const serializedSearchParams = searchParams.toString()
  const navigationKey = serializedSearchParams ? `${pathname}?${serializedSearchParams}` : pathname
  const hasAuthInvalidation = searchParams.get(AUTH_INVALIDATION_SEARCH_PARAM) === "1"
  const coordinatorRef = useRef<ReturnType<typeof createAuthInvalidationCoordinator> | null>(null)
  const previousNavigationRef = useRef(navigationKey)
  const handledAuthRedirectRef = useRef(false)

  useEffect(() => {
    const coordinator = createAuthInvalidationCoordinator({
      channel: createBrowserAuthInvalidationChannel(),
      invalidateProjection: invalidateLocalProjection,
      refreshNavigation() {
        router.refresh()
      },
    })
    const revalidateOnFocus = () => coordinator.revalidate()

    coordinatorRef.current = coordinator
    window.addEventListener("focus", revalidateOnFocus)

    return () => {
      window.removeEventListener("focus", revalidateOnFocus)
      coordinator.dispose()

      if (coordinatorRef.current === coordinator) {
        coordinatorRef.current = null
      }
    }
  }, [invalidateLocalProjection, router])

  useEffect(() => {
    if (previousNavigationRef.current === navigationKey) {
      return
    }

    previousNavigationRef.current = navigationKey
    coordinatorRef.current?.revalidate()
  }, [navigationKey])

  useEffect(() => {
    if (!hasAuthInvalidation || handledAuthRedirectRef.current) {
      return
    }

    handledAuthRedirectRef.current = true
    coordinatorRef.current?.publish()

    const nextSearchParams = new URLSearchParams(serializedSearchParams)
    nextSearchParams.delete(AUTH_INVALIDATION_SEARCH_PARAM)
    const nextQuery = nextSearchParams.size > 0 ? `?${nextSearchParams.toString()}` : ""
    router.replace(`${pathname}${nextQuery}${window.location.hash}`, { scroll: false })
  }, [hasAuthInvalidation, pathname, router, serializedSearchParams])

  const invalidate = useCallback(() => {
    const coordinator = coordinatorRef.current

    if (coordinator) {
      coordinator.invalidate()
    } else {
      invalidateLocalProjection()
    }
  }, [invalidateLocalProjection])

  return (
    <AuthProjectionInvalidationContext.Provider value={invalidate}>
      {children}
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
