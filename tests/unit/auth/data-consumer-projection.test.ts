import { describe, expectTypeOf, it } from "vitest"
import type { useData } from "@/contexts/DataContext"

describe("projected authentication data consumers", () => {
  it("preserves the public async data operation contract", () => {
    type DataContextValue = ReturnType<typeof useData>

    expectTypeOf<DataContextValue["refreshAll"]>().toEqualTypeOf<() => Promise<void>>()
    expectTypeOf<DataContextValue["refreshVehicles"]>().toEqualTypeOf<() => Promise<void>>()
    expectTypeOf<DataContextValue["refreshMaintenance"]>().toEqualTypeOf<() => Promise<void>>()
    expectTypeOf<DataContextValue["refreshScheduledServices"]>().toEqualTypeOf<() => Promise<void>>()
    expectTypeOf<DataContextValue["addVehicleOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["updateVehicleOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["deleteVehicleOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["updateMaintenanceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["deleteMaintenanceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["addScheduledServiceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["updateScheduledServiceOptimistic"]>().returns.toEqualTypeOf<Promise<void>>()
    expectTypeOf<DataContextValue["cancelScheduledService"]>().returns.toEqualTypeOf<Promise<void>>()
  })
})
