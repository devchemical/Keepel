/**
 * Utility functions for consistent formatting across server and client
 */

/**
 * Format numbers with consistent Spanish locale formatting
 * @param value - Number to format
 * @returns Formatted string with Spanish locale (dots as thousands separators)
 */
export function formatNumber(value: number): string {
  return value.toLocaleString("es-ES")
}

/**
 * Format kilometers with consistent formatting
 * @param mileage - Number representing kilometers
 * @returns Formatted string with "km" suffix
 */
export function formatMileage(mileage: number): string {
  return `${formatNumber(mileage)} km`
}

/**
 * Format currency with Spanish locale
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'EUR')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency,
  }).format(amount)
}

/**
 * Format date with consistent Spanish locale
 * @param dateString - Date string to format
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Format short date with consistent Spanish locale
 * @param dateString - Date string to format
 * @returns Formatted short date string
 */
export function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
