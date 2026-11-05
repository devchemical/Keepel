import { describe, expect, it } from "vitest"
import {
  nullableCalendarDaySchema,
  nullableCostSchema,
  nullableMileageSchema,
  nullableTextSchema,
} from "@/lib/data/maintenance-validation"

describe("nullable maintenance numbers", () => {
  it.each(["12oops", "1e3", "0x10", "1,25", "Infinity", "NaN", -1, NaN, Infinity, -Infinity, true, {}, []])(
    "rejects malformed or nonnegative-number violations: %s",
    (value) => {
      expect(nullableCostSchema.safeParse(value).success).toBe(false)
      expect(nullableMileageSchema.safeParse(value).success).toBe(false)
    }
  )
})

describe("maintenance absence and zero", () => {
  it.each([null, undefined, "", "   "])("normalizes absent fields to explicit null: %s", (value) => {
    expect(nullableCostSchema.parse(value)).toBeNull()
    expect(nullableMileageSchema.parse(value)).toBeNull()
    expect(nullableTextSchema.parse(value)).toBeNull()
  })

  it("preserves zero, accepts full decimal cost and trims optional text", () => {
    expect(nullableCostSchema.parse("0")).toBe(0)
    expect(nullableMileageSchema.parse(0)).toBe(0)
    expect(nullableMileageSchema.parse("0")).toBe(0)
    expect(nullableCostSchema.parse(" 12.50 ")).toBe(12.5)
    expect(nullableTextSchema.parse("  taller  ")).toBe("taller")
    expect(nullableTextSchema.safeParse(0).success).toBe(false)
  })

  it.each([1.5, "1.5", Number.MAX_SAFE_INTEGER + 1])("rejects fractional or unsafe mileage: %s", (value) => {
    expect(nullableMileageSchema.safeParse(value).success).toBe(false)
  })
})

describe("optional scheduled calendar day", () => {
  it("turns cleared dates into null and rejects instants or impossible days", () => {
    expect(nullableCalendarDaySchema.parse(" ")).toBeNull()
    expect(nullableCalendarDaySchema.parse(null)).toBeNull()
    expect(nullableCalendarDaySchema.parse(undefined)).toBeNull()
    expect(nullableCalendarDaySchema.parse("2026-01-01")).toBe("2026-01-01")
    expect(nullableCalendarDaySchema.safeParse("2026-02-29").success).toBe(false)
    expect(nullableCalendarDaySchema.safeParse("2026-01-01T00:00:00Z").success).toBe(false)
  })
})
