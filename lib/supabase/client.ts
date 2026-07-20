/* eslint-disable typescript/no-non-null-assertion -- Public Supabase env vars are required at startup. */

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let supabaseClient: SupabaseClient | null = null

export function createClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  supabaseClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
