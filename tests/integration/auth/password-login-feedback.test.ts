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
    expect(markup).not.toContain("Referencia:")
  })

  it("shows the incident reference for temporary unavailability", () => {
    const markup = renderToStaticMarkup(
      createElement(PasswordLoginFeedback, {
        error: {
          code: AUTH_ERROR_CODE.TEMPORARILY_UNAVAILABLE,
          reference: "auth-incident-login",
        },
      })
    )

    expect(markup).toContain(
      "El servicio de acceso no está disponible en este momento. Inténtalo de nuevo en unos minutos."
    )
    expect(markup).toContain("Si el problema persiste, contacta con soporte")
    expect(markup).toContain("Referencia: auth-incident-login")
  })
})
