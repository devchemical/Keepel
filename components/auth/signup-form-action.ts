import { AUTH_ERROR_CODE, SIGN_UP_STATUS, type SignUpResult } from "@/lib/auth/contracts"
import { parseSignupInput } from "@/lib/auth/signup-validation"

interface SignupFormActionDependencies {
  signupAction(previousResult: SignUpResult | null, formData: FormData): Promise<SignUpResult>
  onAuthenticated(destination: string): void
  onConfirmationRequired(destination: string): void
}

export async function runSignupFormAction(
  previousResult: SignUpResult | null,
  formData: FormData,
  dependencies: SignupFormActionDependencies
): Promise<SignUpResult> {
  const signupInput = parseSignupInput({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    fullName: formData.get("fullName"),
  })

  if (!signupInput.success) {
    return {
      status: SIGN_UP_STATUS.ERROR,
      error: { code: AUTH_ERROR_CODE.VALIDATION_FAILED },
    }
  }

  formData.set("email", signupInput.data.email)
  formData.set("fullName", signupInput.data.fullName)
  const result = await dependencies.signupAction(previousResult, formData)

  switch (result.status) {
    case SIGN_UP_STATUS.AUTHENTICATED:
      dependencies.onAuthenticated("/")
      break
    case SIGN_UP_STATUS.CONFIRMATION_REQUIRED:
      dependencies.onConfirmationRequired("/auth/signup-success")
      break
    case SIGN_UP_STATUS.ERROR:
      break
  }

  return result
}
