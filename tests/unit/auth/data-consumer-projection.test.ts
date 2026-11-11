import { describe, expectTypeOf, it } from "vitest"
import type { useData } from "@/contexts/DataContext"
import type { OperationOutcome } from "@/lib/data/operation-machine"

describe("projected authentication data consumers", () => {
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
    expectTypeOf<DataContextValue["replayDataOperation"]>().toEqualTypeOf<
      (operationId: string) => Promise<OperationOutcome>
    >()
    expectTypeOf<DataContextValue["journal"]>().toEqualTypeOf<"healthy" | "unwritable" | "unreadable">()
    expectTypeOf<DataContextValue["operationStorageError"]>().toEqualTypeOf<boolean>()
  })
})
