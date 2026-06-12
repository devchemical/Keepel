/* eslint-disable typescript/no-non-null-assertion -- Supabase env vars are required for middleware session refresh. */

import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  // Rutas públicas y especiales
  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth")
  const isPublicRoute = request.nextUrl.pathname === "/"
  const isNextRoute = request.nextUrl.pathname.startsWith("/_next")
  const isApiRoute = request.nextUrl.pathname.startsWith("/api")
  const isCallbackRoute = request.nextUrl.pathname === "/auth/callback"

  // Permitir acceso sin validación a rutas especiales
  if (isNextRoute || isApiRoute || isCallbackRoute) {
    return supabaseResponse
  }

  // Validar con Supabase. El cliente de Supabase SSR ya optimiza esto a nivel request.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // === LÓGICA DE REDIRECCIONES ===

  // Si usuario autenticado intenta acceder a rutas de auth (excepto callback)
  // IMPORTANTE: No redirigir si no hay usuario, permitir acceso al login
  if (user && isAuthRoute && !isCallbackRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  // Si usuario NO autenticado intenta acceder a rutas protegidas
  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    // Preservar URL original para redirección después de login
    url.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
