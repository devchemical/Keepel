import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { SignupFeedback } from "@/components/auth/signup-feedback"
import { AUTH_ERROR_CODE, type AuthError } from "@/lib/auth/contracts"

describe("signup feedback", () => {
  it.each([
    [AUTH_ERROR_CODE.RATE_LIMITED, "Demasiados intentos de registro. Espera un momento antes de volver a intentarlo."],
    [AUTH_ERROR_CODE.VALIDATION_FAILED, "Revisa el nombre, el email y las contraseñas e inténtalo de nuevo."],
    [AUTH_ERROR_CODE.PROVIDER_ERROR, "No pudimos crear la cuenta. Inténtalo de nuevo."],
    [AUTH_ERROR_CODE.UNEXPECTED, "Ocurrió un error inesperado. Inténtalo de nuevo."],
  ])("translates %s into Keepel copy", (code, expectedMessage) => {
    const markup = renderToStaticMarkup(createElement(SignupFeedback, { error: { code } as AuthError }))

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(expectedMessage)
  })
})
