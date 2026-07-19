import { AUTH_COMMAND_STATUS } from "@/lib/auth/contracts"
import type { LogoutResult } from "@/lib/auth/logout"

interface LogoutFormActionDependencies {
  logoutAction(previousResult: LogoutResult | null, formData: FormData): Promise<LogoutResult>
  onAttempt(): void
  onSuccess(): void
  onError(result: LogoutResult): void
}

export async function runLogoutFormAction(
  previousResult: LogoutResult | null,
  formData: FormData,
  dependencies: LogoutFormActionDependencies
): Promise<LogoutResult> {
  dependencies.onAttempt()
  const result = await dependencies.logoutAction(previousResult, formData)

  if (result.status === AUTH_COMMAND_STATUS.SUCCESS) {
    dependencies.onSuccess()
  } else {
    dependencies.onError(result)
  }

  return result
}
