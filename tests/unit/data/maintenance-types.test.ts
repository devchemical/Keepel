import { describe, expect, it } from "vitest"
import { maintenanceTypeLabel } from "@/lib/data/maintenance-types"

describe("maintenanceTypeLabel", () => {
  it("returns the Spanish label of a known type", () => {
    expect(maintenanceTypeLabel("oil_change")).toBe("Cambio de Aceite")
  })

  it("falls back to the raw value of an unknown type", () => {
    expect(maintenanceTypeLabel("legacy")).toBe("legacy")
  })
})
