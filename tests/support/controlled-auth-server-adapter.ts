import type { AuthServerAdapter } from "@/lib/auth/server-boundary"

export function createControlledAuthServerAdapter(user: unknown): AuthServerAdapter {
  return {
    async getUser() {
      return user
    },
  }
}
