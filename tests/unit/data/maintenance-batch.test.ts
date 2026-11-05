import { describe, expect, it } from "vitest"
import { isEmptyMaintenanceRow, maintenanceBatchSchema } from "@/lib/data/maintenance-validation"

describe("maintenance batch validation", () => {
  it("omits only wholly empty rows and normalizes every complete row", () => {
    expect(isEmptyMaintenanceRow({ id: "ui-only", type: " ", description: "", cost: null })).toBe(true)
    expect(isEmptyMaintenanceRow({ type: "", cost: 0 })).toBe(false)
    expect(
      maintenanceBatchSchema.parse({
        service_date: "2026-01-01",
        mileage: "0",
        notes: " ",
        services: [
          { id: "empty", type: "", description: " ", cost: "" },
          { id: "filled", type: "oil_change", description: "  aceite  ", cost: "0" },
        ],
      })
    ).toEqual({
      service_date: "2026-01-01",
      mileage: 0,
      notes: null,
      services: [{ type: "oil_change", description: "aceite", cost: 0 }],
    })
  })
})

describe("invalid maintenance batches", () => {
  it.each([
    { type: "", description: "aceite", cost: "" },
    { type: "", description: "", cost: "0" },
    { type: "oil_change", cost: "12oops" },
    { type: "unknown_service", cost: "" },
    false,
    null,
  ])("rejects the whole batch and identifies the original invalid row: %s", (row) => {
    const result = maintenanceBatchSchema.safeParse({
      service_date: "2026-01-01",
      mileage: null,
      services: [{ type: "", cost: "" }, { type: "battery" }, row],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "services" && issue.path[1] === 2)).toBe(true)
    }
  })

  it.each([{ services: [] }, { services: [{ type: "", description: " ", cost: null }] }])(
    "rejects a batch with no services: %s",
    ({ services }) => {
      const result = maintenanceBatchSchema.safeParse({ service_date: "2026-01-01", services })
      expect(result.success).toBe(false)
      if (!result.success) expect(result.error.issues[0]?.message).toBe("At least one maintenance service is required")
    }
  )

  it("validates common date and mileage and returns explicit nulls for omitted optional fields", () => {
    expect(
      maintenanceBatchSchema.safeParse({ service_date: "2026-02-30", services: [{ type: "battery" }] }).success
    ).toBe(false)
    expect(
      maintenanceBatchSchema.safeParse({ service_date: "2026-01-01", mileage: "1.5", services: [{ type: "battery" }] })
        .success
    ).toBe(false)
    expect(maintenanceBatchSchema.parse({ service_date: "2026-01-01", services: [{ type: "battery" }] })).toEqual({
      service_date: "2026-01-01",
      mileage: null,
      notes: null,
      services: [{ type: "battery", description: null, cost: null }],
    })
  })
})
