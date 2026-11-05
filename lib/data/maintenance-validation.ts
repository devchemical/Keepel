import { z } from "zod"
import { isCalendarDay } from "@/lib/data/calendar-day"
import { isMaintenanceType } from "@/lib/data/maintenance-types"
import type { MaintenanceType } from "@/lib/data/maintenance-types"

function normalizeOptionalNumber(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (trimmed === "") return null
  // Reject partial parses, exponent/hex notation, locale separators and signs.
  return /^\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : value
}

export const nullableCostSchema = z.preprocess(normalizeOptionalNumber, z.number().finite().nonnegative().nullable())
export const nullableMileageSchema = z.preprocess(
  normalizeOptionalNumber,
  z.number().finite().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable()
)

/** For complete fields: a cleared form value becomes a persisted NULL, never undefined. */
export const nullableTextSchema = z.preprocess(
  (value) => (value === undefined ? null : value),
  z
    .string()
    .trim()
    .nullable()
    .transform((value) => (value === "" ? null : value))
)

export const calendarDaySchema = z.string().refine(isCalendarDay, "Expected a valid YYYY-MM-DD calendar day")
export const nullableCalendarDaySchema = z.preprocess(
  (value) => (isBlank(value) ? null : value),
  calendarDaySchema.nullable()
)
export const maintenanceTypeSchema = z
  .string()
  .trim()
  .pipe(z.custom<MaintenanceType>(isMaintenanceType, "Select a maintenance type"))

export const maintenanceServiceSchema = z.object({
  type: maintenanceTypeSchema,
  description: nullableTextSchema,
  cost: nullableCostSchema,
})

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "")
}

/** The UI-only id is ignored. Zero, invalid values and partial rows are never empty. */
export function isEmptyMaintenanceRow(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return [row.type, row.description, row.cost].every(isBlank)
}

const batchRowSchema = z.unknown().transform((value, context) => {
  if (isEmptyMaintenanceRow(value)) return null
  const result = maintenanceServiceSchema.safeParse(value)
  if (!result.success) {
    for (const issue of result.error.issues) context.addIssue(issue)
    return z.NEVER
  }
  return result.data
})

export const maintenanceBatchSchema = z.object({
  service_date: calendarDaySchema,
  mileage: nullableMileageSchema,
  notes: nullableTextSchema,
  services: z
    .array(batchRowSchema)
    .transform((rows) => rows.filter((row) => row !== null))
    .refine((rows) => rows.length > 0, "At least one maintenance service is required"),
})

export type MaintenanceService = z.output<typeof maintenanceServiceSchema>
export type MaintenanceBatch = z.output<typeof maintenanceBatchSchema>
