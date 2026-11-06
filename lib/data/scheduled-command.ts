import { z } from "zod"
import {
  maintenanceTypeSchema,
  requiredEditorField,
  nullableTextSchema,
  nullableCalendarDaySchema,
  nullableMileageSchema,
} from "@/lib/data/maintenance-validation"

/** Complete editor values: blanks always clear to NULL; never use this as a sparse PATCH. */
export const scheduledServiceValuesSchema = z
  .object({
    type: maintenanceTypeSchema,
    description: requiredEditorField(nullableTextSchema),
    scheduled_date: requiredEditorField(nullableCalendarDaySchema),
    scheduled_mileage: requiredEditorField(nullableMileageSchema),
    notes: requiredEditorField(nullableTextSchema),
  })
  .strict()
export const hasScheduleCriterion = (value: { scheduled_date: string | null; scheduled_mileage: number | null }) =>
  value.scheduled_date !== null || value.scheduled_mileage !== null
export const scheduledServiceSchema = scheduledServiceValuesSchema.refine(hasScheduleCriterion, {
  message: "Debe indicar al menos una fecha o un kilometraje programado",
})
export type ScheduledServiceValues = z.output<typeof scheduledServiceSchema>
