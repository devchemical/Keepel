import { AUTH_ERROR_CODE, SIGN_UP_STATUS, type SignUpResult } from "./contracts"
import { projectCurrentUser } from "./server-boundary"
import type { SignupAuthAdapter } from "./signup"

interface SupabaseSignupUser {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

interface SupabaseSignupResult {
  data: {
    user: SupabaseSignupUser | null
    session: unknown | null
  }
  error: {
    code?: string
  } | null
}

interface SupabaseSignupClient {
  auth: {
    signUp(input: {
      email: string
      password: string
      options: {
        emailRedirectTo: string
        data: { full_name: string }
      }
    }): Promise<SupabaseSignupResult>
  }
}

type CreateSupabaseSignupClient = () => SupabaseSignupClient | Promise<SupabaseSignupClient>

export function mapSupabaseSignupResult({ data, error }: SupabaseSignupResult): SignUpResult {
  if (error || !data.user) {
    return {
      status: SIGN_UP_STATUS.ERROR,
      error: { code: AUTH_ERROR_CODE.PROVIDER_ERROR },
    }
  }

  if (!data.session) {
    return { status: SIGN_UP_STATUS.CONFIRMATION_REQUIRED }
  }

  return {
    status: SIGN_UP_STATUS.AUTHENTICATED,
    user: projectCurrentUser({
      id: data.user.id,
      email: data.user.email,
      userMetadata: data.user.user_metadata,
    }),
  }
}

export function createSupabaseSignupAuthAdapter(createSupabaseClient: CreateSupabaseSignupClient): SignupAuthAdapter {
  return {
    async signUp({ email, password, fullName, emailRedirectTo }) {
      const supabase = await createSupabaseClient()

      return mapSupabaseSignupResult(
        await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: { full_name: fullName },
          },
        })
      )
    },
  }
}
