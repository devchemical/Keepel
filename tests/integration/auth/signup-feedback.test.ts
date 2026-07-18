import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SignupFeedback } from "@/components/auth/signup-feedback"
import { AUTH_ERROR_CODE, SIGN_UP_RATE_LIMIT_SCOPE, type SignUpError } from "@/lib/auth/contracts"

describe("signup feedback", () => {
  it.each([
    [AUTH_ERROR_CODE.VALIDATION_FAILED, "Revisa el nombre, el email y las contraseñas e inténtalo de nuevo."],
    [AUTH_ERROR_CODE.PROVIDER_ERROR, "No pudimos crear la cuenta. Inténtalo de nuevo."],
    [AUTH_ERROR_CODE.UNEXPECTED, "Ocurrió un error inesperado. Inténtalo de nuevo."],
  ])("translates %s into Keepel copy", (code, expectedMessage) => {
    const markup = renderToStaticMarkup(createElement(SignupFeedback, { error: { code } as SignUpError }))

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(expectedMessage)
  })

  it.each([
    [SIGN_UP_RATE_LIMIT_SCOPE.IP, "Demasiados intentos de registro desde esta IP. Intenta más tarde."],
    [
      SIGN_UP_RATE_LIMIT_SCOPE.EMAIL,
      "Demasiados intentos de registro para este email. Por seguridad, espera un momento.",
    ],
  ])("preserves %s rate-limit guidance", (scope, expectedMessage) => {
    const markup = renderToStaticMarkup(
      createElement(SignupFeedback, {
        error: {
          code: AUTH_ERROR_CODE.RATE_LIMITED,
          scope,
          remaining: 0,
          limit: 3,
          reset: Date.now() + 60 * 60 * 1_000,
        },
      })
    )

    expect(markup).toContain(expectedMessage)
    expect(markup).toContain("Podrás intentar de nuevo en 1 hora(s).")
  })
})
