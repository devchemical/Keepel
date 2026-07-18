import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PasswordLoginFeedback } from "@/components/auth/password-login-feedback"
import { AUTH_ERROR_CODE, type AuthError } from "@/lib/auth/contracts"

describe("password login feedback", () => {
  it.each([
    [AUTH_ERROR_CODE.INVALID_CREDENTIALS, "El email o la contraseña no son correctos."],
    [AUTH_ERROR_CODE.RATE_LIMITED, "Demasiados intentos. Espera un momento antes de volver a intentarlo."],
    [AUTH_ERROR_CODE.VALIDATION_FAILED, "Revisa el email y la contraseña e inténtalo de nuevo."],
    [AUTH_ERROR_CODE.PROVIDER_ERROR, "No pudimos iniciar sesión. Inténtalo de nuevo."],
    [AUTH_ERROR_CODE.UNEXPECTED, "Ocurrió un error inesperado. Inténtalo de nuevo."],
  ])("translates %s into Keepel copy", (code, expectedMessage) => {
    const markup = renderToStaticMarkup(createElement(PasswordLoginFeedback, { error: { code } as AuthError }))

    expect(markup).toContain('role="alert"')
    expect(markup).toContain(expectedMessage)
  })
})
