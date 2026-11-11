import { describe, expect, it } from "vitest"
import { getOAuthErrorMessage } from "@/lib/auth/oauth-error-message"

const GENERIC = "Ocurrió un error no especificado durante la autenticación."

describe("getOAuthErrorMessage", () => {
  it.each([
    ["oauth_cancelled", "Cancelaste el inicio de sesión con Google. Puedes intentarlo de nuevo cuando quieras."],
    ["provider_error", "Google no pudo completar el inicio de sesión. Inténtalo de nuevo."],
    ["unexpected", "Ocurrió un error inesperado durante la autenticación. Inténtalo de nuevo."],
  ])("describes the public OAuth code %s", (code, message) => {
    expect(getOAuthErrorMessage(code)).toBe(message)
  })

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["unknown", "<script>alert(1)</script>"],
    ["an auth code that is not an OAuth code", "invalid_credentials"],
    ["a case variant", "OAUTH_CANCELLED"],
    ["repeated", ["oauth_cancelled", "provider_error"]],
  ])("falls back to the generic message when the value is %s", (_label, value) => {
    expect(getOAuthErrorMessage(value)).toBe(GENERIC)
  })

  it("never echoes the raw query value", () => {
    expect(getOAuthErrorMessage("controlled-provider-secret")).not.toContain("controlled-provider-secret")
  })
})
