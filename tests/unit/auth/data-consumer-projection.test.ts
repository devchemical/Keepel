import { describe, expect, expectTypeOf, it } from "vitest"
import { resolveDataAuthTransition } from "@/contexts/data-auth-transition"
import { AUTH_STATE_STATUS, type AuthState, type CurrentUser, type UserId } from "@/lib/auth/contracts"
import type { useData } from "@/contexts/DataContext"
import type { OperationOutcome } from "@/lib/data/operation-machine"

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
    expectTypeOf<DataContextValue["createVehicle"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["updateVehicle"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["deleteVehicle"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["createMaintenanceBatch"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["reconcileMaintenanceBatch"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["updateMaintenance"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["deleteMaintenance"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["createScheduledService"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["updateScheduledService"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["cancelScheduledService"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["reconcileDataOperation"]>().returns.toEqualTypeOf<Promise<OperationOutcome>>()
    expectTypeOf<DataContextValue["journal"]>().toEqualTypeOf<"healthy" | "unwritable" | "unreadable">()
    expectTypeOf<DataContextValue["operationStorageError"]>().toEqualTypeOf<boolean>()
  })
})
