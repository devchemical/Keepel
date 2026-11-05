import { formatCalendarDay } from "@/lib/data/calendar-day"

/**
 * Utility functions for consistent formatting across server and client
 */

/**
 * Format numbers with consistent Spanish locale formatting
 * @param value - Number to format
 * @returns Formatted string with Spanish locale (dots as thousands separators)
 */
export function formatNumber(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("es-ES")
}

/**
 * Format kilometers with consistent formatting
 * @param mileage - Number representing kilometers
 * @returns Formatted string with "km" suffix
 */
export function formatMileage(mileage: number | null): string {
  return mileage === null ? "—" : `${formatNumber(mileage)} km`
}

/**
 * Format currency with Spanish locale
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'EUR')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number | null, currency: string = "EUR"): string {
  if (amount === null) return "—"
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency,
  }).format(amount)
}

/**
 * Format date with consistent Spanish locale
 * @param dateString - Valid YYYY-MM-DD calendar day (timestamps are rejected)
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  return formatCalendarDay(dateString, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Format short date with consistent Spanish locale
 * @param dateString - Valid YYYY-MM-DD calendar day (timestamps are rejected)
 * @returns Formatted short date string
 */
export function formatShortDate(dateString: string): string {
  return formatCalendarDay(dateString, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
