import { AUTH_COMMAND_STATUS, AUTH_ERROR_CODE } from "@/lib/auth/contracts"
import type { PasswordLoginResult } from "@/lib/auth/password-login"
import { parsePasswordLoginCredentials } from "@/lib/auth/password-login-validation"

interface PasswordLoginFormActionDependencies {
  loginAction(previousResult: PasswordLoginResult | null, formData: FormData): Promise<PasswordLoginResult>
  onAttempt(): void
  onError(): void
  onSuccess(destination: string): void
}

export async function runPasswordLoginFormAction(
  previousResult: PasswordLoginResult | null,
  formData: FormData,
  dependencies: PasswordLoginFormActionDependencies
): Promise<PasswordLoginResult> {
  dependencies.onAttempt()

  const credentials = parsePasswordLoginCredentials({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!credentials.success) {
    dependencies.onError()

    return {
      status: AUTH_COMMAND_STATUS.ERROR,
      error: { code: AUTH_ERROR_CODE.VALIDATION_FAILED },
    }
  }

  formData.set("email", credentials.data.email)
  const result = await dependencies.loginAction(previousResult, formData)

  if (result.status === AUTH_COMMAND_STATUS.ERROR) {
    dependencies.onError()
  } else {
    dependencies.onSuccess(result.data.redirectTo)
  }

  return result
}
