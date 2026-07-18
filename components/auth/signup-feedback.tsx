import { AUTH_ERROR_CODE, type AuthError } from "@/lib/auth/contracts"

function getSignupErrorMessage(error: AuthError) {
  switch (error.code) {
    case AUTH_ERROR_CODE.RATE_LIMITED:
      return "Demasiados intentos de registro. Espera un momento antes de volver a intentarlo."
    case AUTH_ERROR_CODE.VALIDATION_FAILED:
      return "Revisa el nombre, el email y las contraseñas e inténtalo de nuevo."
    case AUTH_ERROR_CODE.INVALID_CREDENTIALS:
    case AUTH_ERROR_CODE.PROVIDER_ERROR:
      return "No pudimos crear la cuenta. Inténtalo de nuevo."
    case AUTH_ERROR_CODE.UNEXPECTED:
      return "Ocurrió un error inesperado. Inténtalo de nuevo."
    case AUTH_ERROR_CODE.AUTHENTICATION_REQUIRED:
    case AUTH_ERROR_CODE.SESSION_EXPIRED:
      return "Tu sesión no está disponible. Vuelve a intentarlo."
  }
}

interface SignupFeedbackProps {
  error: AuthError | null
}

export function SignupFeedback({ error }: SignupFeedbackProps) {
  if (!error) {
    return null
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="text-destructive bg-destructive/10 border-destructive/20 rounded-md border p-3 text-sm"
    >
      {getSignupErrorMessage(error)}
    </div>
  )
}
