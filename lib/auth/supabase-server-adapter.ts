import { isAuthSessionMissingError } from "@supabase/supabase-js"
import { AuthenticationProviderError, type AuthServerAdapterUser } from "./server-boundary"

interface SupabaseAuthUser {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}

interface SupabaseUserResult {
  data: {
    user: SupabaseAuthUser | null
  }
  error: unknown | null
}

export function mapSupabaseUserResult({ data, error }: SupabaseUserResult): AuthServerAdapterUser | null {
  if (error) {
    if (isAuthSessionMissingError(error)) {
      return null
    }

    throw new AuthenticationProviderError()
  }

  if (!data.user) {
    return null
  }

  return {
    id: data.user.id,
    email: data.user.email,
    userMetadata: data.user.user_metadata,
  }
}
