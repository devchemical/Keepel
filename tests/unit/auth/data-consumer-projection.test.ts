import { describe, expect, expectTypeOf, it } from "vitest"
import { resolveDataAuthTransition } from "@/contexts/data-auth-transition"
import type { useData } from "@/contexts/DataContext"
import { AUTH_STATE_STATUS, type AuthState, type CurrentUser, type UserId } from "@/lib/auth/contracts"

const user: CurrentUser = {
  id: "user-48" as UserId,
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

describe("projected authentication data consumers", () => {
  it("loads authenticated data once with the projected user id", () => {
    const initialTransition = resolveDataAuthTransition(authenticated, false)
    const repeatedTransition = resolveDataAuthTransition(authenticated, true)

    expect(initialTransition).toEqual({ type: "load", userId: user.id })
    expect(repeatedTransition).toEqual({ type: "idle" })

    if (initialTransition.type === "load") {
      expectTypeOf(initialTransition.userId).toEqualTypeOf<CurrentUser["id"]>()
    }
  })

  it("clears anonymous data and permits a later authenticated reload", () => {
    const anonymousTransition = resolveDataAuthTransition(anonymous, true)
    const reauthenticatedTransition = resolveDataAuthTransition(authenticated, false)

    expect(anonymousTransition).toEqual({ type: "clear" })
    expect(reauthenticatedTransition).toEqual({ type: "load", userId: user.id })
  })

  it("preserves the public async data operation contract", () => {
    type DataContextValue = ReturnType<typeof useData>

    expectTypeOf<DataContextValue["refreshAll"]>().toEqualTypeOf<() => Promise<void>>()
    expectTypeOf<DataContextValue["refreshVehicles"]>().toEqualTypeOf<() => Promise<void>>()
    expectTypeOf<DataContextValue["refreshMaintenance"]>().toEqualTypeOf<() => Promise<void>>()
    expectTypeOf<DataContextValue["refreshScheduledServices"]>().toEqualTypeOf<() => Promise<void>>()
    expectTypeOf<DataContextValue["addVehicleOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["updateVehicleOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["deleteVehicleOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["addMaintenanceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["updateMaintenanceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["deleteMaintenanceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["addScheduledServiceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["updateScheduledServiceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["deleteScheduledServiceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["completeScheduledServiceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
  })
})
