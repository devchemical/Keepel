import { OAUTH_ERROR_CODE } from "./contracts"

export type GoogleOAuthStartResult =
  | { started: true; authorizationUrl: string }
  | { started: false; errorCode: typeof OAUTH_ERROR_CODE.PROVIDER_ERROR }

export interface GoogleOAuthAdapter {
  createAuthorizationUrl(callbackUrl: string): Promise<GoogleOAuthStartResult>
}

interface SupabaseGoogleOAuthResult {
  data: unknown
  error: unknown
}

interface SupabaseGoogleOAuthClient {
  auth: {
    signInWithOAuth(input: {
      provider: "google"
      options: {
        redirectTo: string
        queryParams: {
          access_type: "offline"
          prompt: "consent"
        }
        skipBrowserRedirect: true
      }
    }): Promise<SupabaseGoogleOAuthResult>
  }
}

type CreateSupabaseGoogleOAuthClient = () => SupabaseGoogleOAuthClient | Promise<SupabaseGoogleOAuthClient>

function isGoogleAuthorizationUrl(value: unknown, supabaseUrl: string): value is string {
  if (typeof value !== "string") {
    return false
  }

  try {
    const expectedUrl = new URL("/auth/v1/authorize", supabaseUrl)
    const authorizationUrl = new URL(value)

    return (
      (expectedUrl.protocol === "https:" || expectedUrl.protocol === "http:") &&
      authorizationUrl.origin === expectedUrl.origin &&
      authorizationUrl.pathname === expectedUrl.pathname &&
      authorizationUrl.username === "" &&
      authorizationUrl.password === "" &&
      authorizationUrl.searchParams.get("provider") === "google"
    )
  } catch {
    return false
  }
}

export function createSupabaseGoogleOAuthAdapter(
  createSupabaseClient: CreateSupabaseGoogleOAuthClient,
  supabaseUrl: string
): GoogleOAuthAdapter {
  return {
    async createAuthorizationUrl(callbackUrl) {
      const supabase = await createSupabaseClient()
      const providerResult = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          skipBrowserRedirect: true,
        },
      })

      const authorizationUrl =
        typeof providerResult.data === "object" &&
        providerResult.data !== null &&
        "url" in providerResult.data &&
        "provider" in providerResult.data &&
        providerResult.data.provider === "google"
          ? providerResult.data.url
          : null

      return providerResult.error === null && isGoogleAuthorizationUrl(authorizationUrl, supabaseUrl)
        ? { started: true, authorizationUrl }
        : { started: false, errorCode: OAUTH_ERROR_CODE.PROVIDER_ERROR }
    },
  }
}
