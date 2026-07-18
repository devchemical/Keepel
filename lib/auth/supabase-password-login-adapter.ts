import { AUTH_ERROR_CODE } from "./contracts"
import type { PasswordLoginAdapterResult, PasswordLoginAuthAdapter } from "./password-login"

interface SupabasePasswordLoginResult {
  data: {
    user: unknown | null
    session: unknown | null
  }
  error: {
    code?: string
  } | null
}

interface SupabasePasswordLoginClient {
  auth: {
    signInWithPassword(credentials: { email: string; password: string }): Promise<SupabasePasswordLoginResult>
  }
}

type CreateSupabasePasswordLoginClient = () => SupabasePasswordLoginClient | Promise<SupabasePasswordLoginClient>

export function mapSupabasePasswordLoginResult({
  data,
  error,
}: SupabasePasswordLoginResult): PasswordLoginAdapterResult {
  if (error) {
    return {
      authenticated: false,
      errorCode:
        error.code === "invalid_credentials" ? AUTH_ERROR_CODE.INVALID_CREDENTIALS : AUTH_ERROR_CODE.PROVIDER_ERROR,
    }
  }

  return data.user && data.session
    ? { authenticated: true }
    : { authenticated: false, errorCode: AUTH_ERROR_CODE.PROVIDER_ERROR }
}

export function createSupabasePasswordLoginAuthAdapter(
  createSupabaseClient: CreateSupabasePasswordLoginClient
): PasswordLoginAuthAdapter {
  return {
    async signInWithPassword(credentials) {
      const supabase = await createSupabaseClient()

      return mapSupabasePasswordLoginResult(await supabase.auth.signInWithPassword(credentials))
    },
  }
}
