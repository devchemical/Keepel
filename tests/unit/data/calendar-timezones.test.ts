import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"

// Separate processes make TZ meaningful even when Vitest uses worker threads.
const probe = `
  import { localToday, addCalendarDays, calendarDaysBetween, compareCalendarDays } from "./lib/data/calendar-day.ts"
  import { formatDate, formatShortDate } from "./lib/formatters.ts"
  const today = localToday(new Date("2026-01-01T01:00:00Z"))
  console.log(JSON.stringify({
    today,
    early: localToday(new Date(2026, 0, 1, 0, 5)),
    late: localToday(new Date(2026, 0, 1, 23, 55)),
    long: formatDate("2026-01-01"),
    short: formatShortDate("2026-01-01"),
    skippedDay: formatDate("2011-12-30"),
    yesterday: compareCalendarDays(addCalendarDays(today, -1), today),
    sameDay: compareCalendarDays(today, today),
    days30: calendarDaysBetween(today, addCalendarDays(today, 30)),
    days31: calendarDaysBetween(today, addCalendarDays(today, 31)),
    dst: calendarDaysBetween("2026-03-07", "2026-04-06"),
  }))
`

describe("calendar days in opposing timezones", () => {
  it.each([
    ["America/Los_Angeles", "2025-12-31"],
    ["Pacific/Kiritimati", "2026-01-01"],
    ["Pacific/Apia", "2026-01-01"],
    ["UTC", "2026-01-01"],
  ])("preserves calendar semantics in %s", (timezone, today) => {
    const output = execFileSync("bun", ["-e", probe], {
      env: { ...process.env, TZ: timezone },
      encoding: "utf8",
    })
    expect(JSON.parse(output)).toEqual({
      today,
      early: "2026-01-01",
      late: "2026-01-01",
      long: "1 de enero de 2026",
      short: "1 ene 2026",
      skippedDay: "30 de diciembre de 2011",
      yesterday: -1,
      sameDay: 0,
      days30: 30,
      days31: 31,
      dst: 30,
    })
  })
})
