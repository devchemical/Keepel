import "server-only"

import { cache } from "react"
import { createClient } from "@/lib/supabase/server"
import { createAuthServerApi, type AuthServerAdapter } from "./server-boundary"
import { mapSupabaseUserResult } from "./supabase-server-adapter"

const getUser = cache(async () => {
  const supabase = await createClient()
  const result = await supabase.auth.getUser()

  return mapSupabaseUserResult(result)
}) satisfies AuthServerAdapter["getUser"]

const authServerApi = createAuthServerApi({ getUser })

export const { getAuthState, getCurrentUser, requireCurrentUser } = authServerApi
