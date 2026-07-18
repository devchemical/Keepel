import { describe, expect, expectTypeOf, it } from "vitest"
import {
  AUTH_COMMAND_STATUS,
  AUTH_ERROR_CODE,
  AUTH_STATE_STATUS,
  SIGN_UP_STATUS,
  type AuthCommandResult,
  type AuthErrorCode,
  type AuthState,
  type CurrentUser,
  type SignUpResult,
  type UserId,
} from "@/lib/auth/contracts"

describe("auth contracts", () => {
  it("derives every discriminant from its typed constants", () => {
    expectTypeOf<AuthState["status"]>().toEqualTypeOf<(typeof AUTH_STATE_STATUS)[keyof typeof AUTH_STATE_STATUS]>()
    expectTypeOf<AuthCommandResult["status"]>().toEqualTypeOf<
      (typeof AUTH_COMMAND_STATUS)[keyof typeof AUTH_COMMAND_STATUS]
    >()
    expectTypeOf<AuthErrorCode>().toEqualTypeOf<(typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE]>()
    expectTypeOf<SignUpResult["status"]>().toEqualTypeOf<(typeof SIGN_UP_STATUS)[keyof typeof SIGN_UP_STATUS]>()
    expectTypeOf<CurrentUser["id"]>().toEqualTypeOf<UserId>()

    expect(Object.values(AUTH_STATE_STATUS)).toEqual(["anonymous", "authenticated"])
    expect(Object.values(AUTH_COMMAND_STATUS)).toEqual(["success", "error"])
    expect(Object.values(AUTH_ERROR_CODE)).toContain("authentication_required")
    expect(Object.values(SIGN_UP_STATUS)).toEqual(["authenticated", "confirmation_required", "error"])
  })

  it("represents only valid authentication states", () => {
    const user: CurrentUser = {
      id: "user-1" as UserId,
      email: "driver@example.com",
      displayName: "Ada Driver",
    }
    const authenticated: AuthState = {
      status: AUTH_STATE_STATUS.AUTHENTICATED,
      user,
    }
    const anonymous: AuthState = {
      status: AUTH_STATE_STATUS.ANONYMOUS,
      user: null,
    }

    expect(authenticated).toEqual({ status: "authenticated", user })
    expect(anonymous).toEqual({ status: "anonymous", user: null })
  })
})
