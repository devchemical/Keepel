import { OAUTH_ERROR_CODE, type OAuthErrorCode } from "./contracts"

const OAUTH_ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
  [OAUTH_ERROR_CODE.CANCELLED]: "Cancelaste el inicio de sesión con Google. Puedes intentarlo de nuevo cuando quieras.",
  [OAUTH_ERROR_CODE.PROVIDER_ERROR]: "Google no pudo completar el inicio de sesión. Inténtalo de nuevo.",
  [OAUTH_ERROR_CODE.UNEXPECTED]: "Ocurrió un error inesperado durante la autenticación. Inténtalo de nuevo.",
}

const GENERIC_OAUTH_ERROR_MESSAGE = "Ocurrió un error no especificado durante la autenticación."

function isOAuthErrorCode(value: unknown): value is OAuthErrorCode {
  return typeof value === "string" && Object.hasOwn(OAUTH_ERROR_MESSAGES, value)
}

/**
 * Maps the untrusted `error` query value of `/auth/error` to user-facing copy. The raw value is never
 * echoed: anything that is not exactly one public OAuth code gets the generic message.
 */
export function getOAuthErrorMessage(value: string | string[] | undefined): string {
  return isOAuthErrorCode(value) ? OAUTH_ERROR_MESSAGES[value] : GENERIC_OAUTH_ERROR_MESSAGE
}
