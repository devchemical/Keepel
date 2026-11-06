import { describe, expect, it } from "vitest"
import {
  addCalendarDays,
  calendarDaysBetween,
  compareCalendarDays,
  isCalendarDay,
  localToday,
  parseCalendarDay,
} from "@/lib/data/calendar-day"

describe("calendar-day arithmetic", () => {
  it("compares yesterday, today, +30 and +31 without elapsed-time or DST drift", () => {
    expect(addCalendarDays("2026-03-07", -1)).toBe("2026-03-06")
    expect(addCalendarDays("2026-03-07", 30)).toBe("2026-04-06")
    expect(addCalendarDays("2026-03-07", 31)).toBe("2026-04-07")
    expect(compareCalendarDays("2026-03-06", "2026-03-07")).toBe(-1)
    expect(compareCalendarDays("2026-03-07", "2026-03-07")).toBe(0)
    expect(compareCalendarDays("2026-04-06", "2026-03-07")).toBe(1)
    expect(calendarDaysBetween("2026-03-07", "2026-04-06")).toBe(30)
    expect(calendarDaysBetween("2026-03-07", "2026-04-07")).toBe(31)
    expect(calendarDaysBetween("2026-03-07", "2026-03-06")).toBe(-1)
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29")
    expect(addCalendarDays("0099-12-31", 1)).toBe("0100-01-01")
  })
})

describe("local current day and strict input", () => {
  it("uses local date fields near both ends of a day", () => {
    expect(localToday(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01")
    expect(localToday(new Date(2026, 0, 1, 23, 55))).toBe("2026-01-01")
  })

  it.each(["2026-02-29", "2026-04-31", "2026-1-01", "2026-01-01T00:00:00Z", "0000-01-01", "", null])(
    "rejects invalid or noncanonical day %s",
    (value) => {
      expect(isCalendarDay(value)).toBe(false)
      expect(() => parseCalendarDay(value)).toThrow(RangeError)
    }
  )

  it("accepts leap days and rejects invalid arithmetic", () => {
    expect(parseCalendarDay("2024-02-29")).toBe("2024-02-29")
    expect(() => addCalendarDays("9999-12-31", 1)).toThrow(RangeError)
    expect(() => addCalendarDays("0001-01-01", -1)).toThrow(RangeError)
    expect(() => addCalendarDays("2026-01-01", 0.5)).toThrow(RangeError)
    expect(() => localToday(new Date(NaN))).toThrow(RangeError)
  })
})
