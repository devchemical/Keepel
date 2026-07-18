import { AUTH_ERROR_CODE, type AuthError } from "@/lib/auth/contracts"

function getPasswordLoginErrorMessage(error: AuthError) {
  switch (error.code) {
    case AUTH_ERROR_CODE.INVALID_CREDENTIALS:
      return "El email o la contraseña no son correctos."
    case AUTH_ERROR_CODE.RATE_LIMITED:
      return "Demasiados intentos. Espera un momento antes de volver a intentarlo."
    case AUTH_ERROR_CODE.VALIDATION_FAILED:
      return "Revisa el email y la contraseña e inténtalo de nuevo."
    case AUTH_ERROR_CODE.PROVIDER_ERROR:
      return "No pudimos iniciar sesión. Inténtalo de nuevo."
    case AUTH_ERROR_CODE.UNEXPECTED:
      return "Ocurrió un error inesperado. Inténtalo de nuevo."
    case AUTH_ERROR_CODE.AUTHENTICATION_REQUIRED:
    case AUTH_ERROR_CODE.SESSION_EXPIRED:
      return "Tu sesión no está disponible. Inicia sesión de nuevo."
  }
}

interface PasswordLoginFeedbackProps {
  error: AuthError | null
}

export function PasswordLoginFeedback({ error }: PasswordLoginFeedbackProps) {
  if (!error) {
    return null
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="text-destructive bg-destructive/10 border-destructive/20 rounded-md border p-3 text-sm"
    >
      {getPasswordLoginErrorMessage(error)}
    </div>
  )
}
