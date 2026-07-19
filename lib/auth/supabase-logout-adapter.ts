import { AUTH_COMMAND_STATUS, AUTH_ERROR_CODE } from "./contracts"
import type { LogoutAuthAdapter, LogoutResult } from "./logout"

interface SupabaseLogoutClient {
  auth: {
    signOut(options: { scope: "local" }): Promise<unknown>
  }
}

type CreateSupabaseLogoutClient = () => SupabaseLogoutClient | Promise<SupabaseLogoutClient>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function mapSupabaseLogoutResult(result: unknown): LogoutResult {
  if (!isRecord(result) || !("error" in result) || result.error !== null) {
    return {
      status: AUTH_COMMAND_STATUS.ERROR,
      error: { code: AUTH_ERROR_CODE.PROVIDER_ERROR },
    }
  }

  return { status: AUTH_COMMAND_STATUS.SUCCESS, data: null }
}

export function createSupabaseLogoutAuthAdapter(createSupabaseClient: CreateSupabaseLogoutClient): LogoutAuthAdapter {
  return {
    async signOut() {
      const supabase = await createSupabaseClient()

      return mapSupabaseLogoutResult(await supabase.auth.signOut({ scope: "local" }))
    },
  }
}
