/* eslint-disable typescript/no-explicit-any, typescript/no-non-null-assertion -- Supabase cookie adapter exposes loose option objects and env vars are required. */

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let supabaseClient: SupabaseClient | null = null

export function createClient() {
  // Si ya existe una instancia, la reutilizamos
  if (supabaseClient) {
    return supabaseClient
  }

  // Crear una nueva instancia con manejo correcto de cookies
  supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Usar document.cookie para leer cookies
          if (typeof document === "undefined") return undefined
          const cookies = document.cookie.split("; ")
          const cookie = cookies.find((c) => c.startsWith(`${name}=`))
          return cookie ? decodeURIComponent(cookie.split("=")[1]) : undefined
        },
        set(name: string, value: string, options: any) {
          // Usar document.cookie para escribir cookies
          if (typeof document === "undefined") return
          let cookie = `${name}=${encodeURIComponent(value)}`

          if (options?.maxAge) {
            cookie += `; max-age=${options.maxAge}`
          }
          if (options?.path) {
            cookie += `; path=${options.path}`
          }
          if (options?.domain) {
            cookie += `; domain=${options.domain}`
          }
          if (options?.sameSite) {
            cookie += `; samesite=${options.sameSite}`
          }
          if (options?.secure) {
            cookie += "; secure"
          }

          document.cookie = cookie
        },
        remove(name: string, options: any) {
          // Eliminar cookie estableciendo max-age a 0
          if (typeof document === "undefined") return
          let cookie = `${name}=; max-age=0`

          if (options?.path) {
            cookie += `; path=${options.path}`
          }
          if (options?.domain) {
            cookie += `; domain=${options.domain}`
          }

          document.cookie = cookie
        },
      },
      auth: {
        skipAutoInitialize: true,
      },
      isSingleton: false,
    }
  )

  // Data requests read the SSR session lazily; Supabase's auth channel must not broadcast that session.
  void supabaseClient.auth.dispose()

  return supabaseClient
}
