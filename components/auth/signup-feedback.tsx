import { AUTH_ERROR_CODE, SIGN_UP_RATE_LIMIT_SCOPE, type SignUpError } from "@/lib/auth/contracts"

function getSignupErrorMessage(error: SignUpError) {
  switch (error.code) {
    case AUTH_ERROR_CODE.RATE_LIMITED: {
      const reason =
        error.scope === SIGN_UP_RATE_LIMIT_SCOPE.IP
          ? "Demasiados intentos de registro desde esta IP. Intenta más tarde."
          : "Demasiados intentos de registro para este email. Por seguridad, espera un momento."
      const hoursLeft = Math.max(1, Math.ceil((error.reset - Date.now()) / 1_000 / 60 / 60))

      return `${reason} Podrás intentar de nuevo en ${hoursLeft} hora(s).`
    }
    case AUTH_ERROR_CODE.VALIDATION_FAILED:
      return "Revisa el nombre, el email y las contraseñas e inténtalo de nuevo."
    case AUTH_ERROR_CODE.INVALID_CREDENTIALS:
    case AUTH_ERROR_CODE.PROVIDER_ERROR:
      return "No pudimos crear la cuenta. Inténtalo de nuevo."
    case AUTH_ERROR_CODE.TEMPORARILY_UNAVAILABLE:
      return "El servicio de acceso no está disponible en este momento. Inténtalo de nuevo en unos minutos."
    case AUTH_ERROR_CODE.UNEXPECTED:
      return "Ocurrió un error inesperado. Inténtalo de nuevo."
    case AUTH_ERROR_CODE.AUTHENTICATION_REQUIRED:
    case AUTH_ERROR_CODE.SESSION_EXPIRED:
      return "Tu sesión no está disponible. Vuelve a intentarlo."
  }
}

interface SignupFeedbackProps {
  error: SignUpError | null
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
      {error.code === AUTH_ERROR_CODE.TEMPORARILY_UNAVAILABLE && (
        <span className="text-muted-foreground mt-2 block text-xs">
          Si el problema persiste, contacta con soporte e indica esta referencia.
          <span className="text-destructive mt-1 block font-mono select-all">Referencia: {error.reference}</span>
        </span>
      )}
    </div>
  )
}
