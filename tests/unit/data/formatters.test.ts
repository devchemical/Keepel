import { describe, expect, it } from "vitest"
import { formatCurrency, formatDate, formatMileage, formatNumber, formatShortDate } from "@/lib/formatters"

describe("maintenance calendar-day formatting", () => {
  it("preserves the entered day, including a day skipped by a local timezone", () => {
    expect(formatDate("2026-01-01")).toBe("1 de enero de 2026")
    expect(formatShortDate("2026-01-01")).toBe("1 ene 2026")
    expect(formatDate("2011-12-30")).toBe("30 de diciembre de 2011")
  })
})

describe("nullable numeric presentation", () => {
  it("distinguishes zero from an unreported value", () => {
    expect(formatNumber(0)).toBe("0")
    expect(formatMileage(0)).toBe("0 km")
    expect(formatCurrency(0)).toBe("0,00\u00a0€")
    expect(formatNumber(null)).toBe("—")
    expect(formatMileage(null)).toBe("—")
    expect(formatCurrency(null)).toBe("—")
  })
})
