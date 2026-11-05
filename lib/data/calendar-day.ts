/** Calendar dates use Gregorian YYYY-MM-DD (years 0001–9999), never instants. */
export function isCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) {
    return false
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function parseCalendarDay(value: unknown): string {
  if (!isCalendarDay(value)) throw new RangeError("Expected a valid YYYY-MM-DD calendar day")
  return value
}

/** UTC is only a formatting anchor; it never determines the user's current day. */
export function formatCalendarDay(
  day: string,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone"> = {},
  locale = "es-ES"
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(`${parseCalendarDay(day)}T00:00:00.000Z`)
  )
}

export function addCalendarDays(day: string, days: number): string {
  if (!Number.isSafeInteger(days)) throw new RangeError("Expected an integer day offset")
  const date = new Date(`${parseCalendarDay(day)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  if (!Number.isFinite(date.getTime())) throw new RangeError("Calendar day out of range")
  return parseCalendarDay(date.toISOString().slice(0, 10))
}

/** Negative means left is earlier; equality means the same calendar day. */
export function compareCalendarDays(left: string, right: string): -1 | 0 | 1 {
  const a = parseCalendarDay(left)
  const b = parseCalendarDay(right)
  return a < b ? -1 : a > b ? 1 : 0
}

/** Signed count from start to end; unaffected by DST or the host timezone. */
export function calendarDaysBetween(start: string, end: string): number {
  return (Date.parse(`${parseCalendarDay(end)}T00:00:00Z`) - Date.parse(`${parseCalendarDay(start)}T00:00:00Z`)) / 86_400_000
}

/** Call in the user's timezone, or pass the user's validated day to server commands. */
export function localToday(now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new RangeError("Expected a valid date")
  return parseCalendarDay(
    `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  )
}
