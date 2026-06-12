/* eslint-disable typescript/no-non-null-assertion -- Supabase env vars are required at startup for auth routes. */

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  const cookieStore = await cookies()

  // Create Supabase client with server-side cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // Sign out from Supabase (this clears the session on the server)
  await supabase.auth.signOut()

  // Manually clear all Supabase cookies
  const allCookies = cookieStore.getAll()
  for (const cookie of allCookies) {
    if (cookie.name.includes("supabase") || cookie.name.includes("sb-")) {
      cookieStore.set(cookie.name, "", {
        maxAge: 0,
        path: "/",
      })
    }
  }

  // Return success response
  return NextResponse.json({ success: true }, { status: 200 })
}
