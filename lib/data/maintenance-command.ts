import { z } from "zod"
import { calendarDaySchema, maintenanceBatchSchema } from "./maintenance-validation"
import type { Database, Tables } from "@/lib/supabase/database.types"

export const maintenanceCommandSchema = z
  .object({
    operationId: z.string().uuid(),
    vehicleId: z.string().uuid(),
    today: calendarDaySchema,
    batch: maintenanceBatchSchema,
    completion: z
      .object({ scheduled_service_id: z.string().uuid(), service_index: z.number().int().nonnegative() })
      .nullable()
      .default(null),
  })
  .superRefine((command, context) => {
    if (command.batch.services.length > 100)
      context.addIssue({ code: "custom", path: ["batch", "services"], message: "Máximo 100 servicios por operación" })
    if (
      command.completion &&
      (command.completion.service_index >= command.batch.services.length || command.batch.service_date > command.today)
    ) {
      context.addIssue({
        code: "custom",
        path: ["completion"],
        message: "Selecciona un servicio realizado para resolver la previsión",
      })
    }
  })
export type MaintenanceCommand = z.output<typeof maintenanceCommandSchema>
export type MaintenanceBatchResult = { status: "success" } | { status: "unknown" } | { status: "rejected" }

const nullableText = z.string().nullable()
const timestamps = { created_at: nullableText, updated_at: nullableText }
const recordSchema = z.object({
  id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.string(),
  description: nullableText,
  cost: z.number().nonnegative().nullable(),
  mileage: z.number().int().nonnegative().nullable(),
  service_date: calendarDaySchema,
  notes: nullableText,
  ...timestamps,
}) satisfies z.ZodType<Tables<"maintenance_records">>
const vehicleSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  license_plate: nullableText,
  vin: nullableText,
  color: nullableText,
  mileage: z.number().int().nonnegative().nullable(),
  ...timestamps,
}) satisfies z.ZodType<Tables<"vehicles">>
const scheduledSchema = z.object({
  id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.string(),
  description: nullableText,
  scheduled_date: calendarDaySchema.nullable(),
  scheduled_mileage: z.number().int().nonnegative().nullable(),
  status: z.enum(["pending", "completed", "cancelled"]),
  notes: nullableText,
  completed_record_id: z.string().uuid().nullable(),
  ...timestamps,
}) satisfies z.ZodType<Tables<"scheduled_services">>
export const maintenanceReceiptSchema = z.object({
  operation_id: z.string().uuid(),
  records: z.array(recordSchema).min(1),
  vehicle: vehicleSchema,
  scheduled_service: scheduledSchema.nullable(),
})
export type MaintenanceReceipt = z.output<typeof maintenanceReceiptSchema>

export function maintenanceRpcArgs(
  command: MaintenanceCommand
): Database["public"]["Functions"]["create_maintenance_batch"]["Args"] {
  return {
    p_operation_id: command.operationId,
    p_vehicle_id: command.vehicleId,
    p_today: command.today,
    p_batch: command.batch,
    p_completion: command.completion,
  }
}

/** Validate the response before acknowledging this specific operation. */
export function readMaintenanceReceipt(
  value: unknown,
  command: MaintenanceCommand,
  userId: string
): MaintenanceReceipt | null {
  const parsed = maintenanceReceiptSchema.safeParse(value)
  if (!parsed.success) return null
  const receipt = parsed.data
  if (
    receipt.operation_id !== command.operationId ||
    receipt.vehicle.id !== command.vehicleId ||
    receipt.vehicle.user_id !== userId ||
    receipt.records.length !== command.batch.services.length ||
    receipt.records.some((row) => row.vehicle_id !== command.vehicleId || row.user_id !== userId)
  )
    return null
  if (command.completion) {
    if (
      receipt.scheduled_service?.id !== command.completion.scheduled_service_id ||
      receipt.scheduled_service.status !== "completed" ||
      receipt.scheduled_service.vehicle_id !== command.vehicleId ||
      receipt.scheduled_service.user_id !== userId ||
      receipt.scheduled_service.completed_record_id !== receipt.records[command.completion.service_index]?.id
    )
      return null
  } else if (receipt.scheduled_service !== null) return null
  return receipt
}
