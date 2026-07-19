/* eslint-disable typescript/no-non-null-assertion -- Supabase env vars are required for proxy session refresh. */

import { NextResponse, type NextRequest } from "next/server"
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { sanitizeInternalRedirect } from "@/lib/auth/redirects"

interface ProxyCookie {
  name: string
  value: string
  options: CookieOptions
}

export interface AuthProxyAdapter {
  getClaims(): Promise<unknown>
  getCookiesToSet(): readonly ProxyCookie[]
}

export type AuthProxyAdapterFactory = (request: NextRequest) => AuthProxyAdapter

function applyResponseCookies(response: NextResponse, cookies: readonly ProxyCookie[]) {
  cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasVerifiedSubject(claimsResult: unknown): boolean {
  if (
    !isRecord(claimsResult) ||
    claimsResult.error !== null ||
    !isRecord(claimsResult.data) ||
    !isRecord(claimsResult.data.claims)
  ) {
    return false
  }

  return typeof claimsResult.data.claims.sub === "string" && claimsResult.data.claims.sub.trim().length > 0
}

function isProtectedRoute(pathname: string): boolean {
  return pathname === "/vehicles" || pathname.startsWith("/vehicles/")
}

function isGuestOnlyRoute(pathname: string): boolean {
  const isAuthRoute = pathname === "/auth" || pathname.startsWith("/auth/")

  return isAuthRoute && pathname !== "/auth/callback"
}

export function createAuthProxy(createAdapter: AuthProxyAdapterFactory) {
  return async function authProxy(request: NextRequest) {
    const adapter = createAdapter(request)
    let claimsResult: unknown = null

    try {
      claimsResult = await adapter.getClaims()
    } catch {
      // Navigation fails closed when the provider cannot verify the request.
    }

    let response: NextResponse

    const isAuthenticated = hasVerifiedSubject(claimsResult)

    if (isGuestOnlyRoute(request.nextUrl.pathname) && isAuthenticated) {
      const destination = sanitizeInternalRedirect(request.nextUrl.searchParams.get("redirect"))
      response = NextResponse.redirect(new URL(destination, request.nextUrl.origin))
    } else if (isProtectedRoute(request.nextUrl.pathname) && !isAuthenticated) {
      const returnDestination = sanitizeInternalRedirect(
        `${request.nextUrl.pathname}${request.nextUrl.search}${request.nextUrl.hash}`
      )
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = "/auth/login"
      loginUrl.search = ""
      loginUrl.hash = ""
      loginUrl.searchParams.set("redirect", returnDestination)
      response = NextResponse.redirect(loginUrl)
    } else {
      response = NextResponse.next({ request })
    }

    applyResponseCookies(response, adapter.getCookiesToSet())

    return response
  }
}

function createSupabaseAuthProxyAdapter(request: NextRequest): AuthProxyAdapter {
  const cookiesToSet: ProxyCookie[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(nextCookies) {
          nextCookies.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.push(...nextCookies)
        },
      },
    }
  )

  return {
    getClaims() {
      return supabase.auth.getClaims()
    },
    getCookiesToSet() {
      return cookiesToSet
    },
  }
}

export const handleAuthProxyRequest = createAuthProxy(createSupabaseAuthProxyAdapter)
