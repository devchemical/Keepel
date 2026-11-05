import { describe, expect, it } from "vitest"
import { formatDate, formatShortDate } from "@/lib/formatters"

describe("maintenance calendar-day formatting", () => {
  it("preserves the entered day, including a day skipped by a local timezone", () => {
    expect(formatDate("2026-01-01")).toBe("1 de enero de 2026")
    expect(formatShortDate("2026-01-01")).toBe("1 ene 2026")
    expect(formatDate("2011-12-30")).toBe("30 de diciembre de 2011")
  })
})
