import { describe, expectTypeOf, it } from "vitest"
import type { AuthContextValue } from "@/contexts/AuthContext"
import type { useAuth as useLegacyAuth } from "@/hooks/useAuth"

describe("client authentication contract", () => {
  it("keeps profile loading and updates outside the public auth interface", () => {
    expectTypeOf<AuthContextValue>().not.toHaveProperty("profile")
    expectTypeOf<AuthContextValue>().not.toHaveProperty("refreshProfile")
    expectTypeOf<ReturnType<typeof useLegacyAuth>>().not.toHaveProperty("profile")
  })
})
