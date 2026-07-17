import type { AuthCallbackAdapter, AuthCallbackExchangeResult } from "@/app/auth/callback/route"

export function createControlledAuthCallbackAdapter(result: AuthCallbackExchangeResult): AuthCallbackAdapter {
  return {
    async exchangeCodeForSession() {
      return result
    },
  }
}
