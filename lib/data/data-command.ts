import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import {
  calendarDaySchema,
  nullableCostSchema,
  nullableMileageSchema,
  nullableTextSchema,
  maintenanceTypeSchema,
  requiredEditorField,
} from "./maintenance-validation"
import { recordSchema, vehicleSchema, scheduledSchema } from "./maintenance-command"
import { scheduledServiceSchema, scheduledServiceValuesSchema, hasScheduleCriterion } from "./scheduled-command"

export const vehicleValuesSchema = z
  .object({
    make: z.string().trim().min(1),
    model: z.string().trim().min(1),
    year: z.preprocess(
      (value) => (typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value),
      z.number().int().min(1).max(9999)
    ),
    mileage: requiredEditorField(nullableMileageSchema),
    license_plate: requiredEditorField(nullableTextSchema),
    vin: requiredEditorField(nullableTextSchema),
    color: requiredEditorField(nullableTextSchema),
  })
  .strict()
export type VehicleValues = z.output<typeof vehicleValuesSchema>
export const maintenanceValuesSchema = z
  .object({
    type: maintenanceTypeSchema,
    description: requiredEditorField(nullableTextSchema),
    cost: requiredEditorField(nullableCostSchema),
    mileage: requiredEditorField(nullableMileageSchema),
    service_date: calendarDaySchema,
    notes: requiredEditorField(nullableTextSchema),
  })
  .strict()
export type MaintenanceValues = z.output<typeof maintenanceValuesSchema>
const identity = { operationId: z.string().uuid(), id: z.string().uuid() }
const empty = z.object({}).strict()
export const dataCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...identity, action: z.literal("vehicle.create"), values: vehicleValuesSchema }),
  z.object({ ...identity, action: z.literal("vehicle.update"), values: vehicleValuesSchema }),
  z.object({ ...identity, action: z.literal("vehicle.delete"), values: empty }),
  z.object({ ...identity, action: z.literal("maintenance.update"), values: maintenanceValuesSchema }),
  z.object({ ...identity, action: z.literal("maintenance.delete"), values: empty }),
  z.object({
    ...identity,
    action: z.literal("schedule.create"),
    values: scheduledServiceValuesSchema.extend({ vehicle_id: z.string().uuid() }).refine(hasScheduleCriterion),
  }),
  z.object({ ...identity, action: z.literal("schedule.update"), values: scheduledServiceSchema }),
  z.object({ ...identity, action: z.literal("schedule.cancel"), values: empty }),
])
export type DataCommand = z.output<typeof dataCommandSchema>
export const dataReceiptSchema = z.object({
  operation_id: z.string().uuid(),
  action: z.string(),
  row: z.union([vehicleSchema, recordSchema, scheduledSchema]),
})
export type DataReceipt = z.output<typeof dataReceiptSchema>
export type DataOutcome = { status: "success"; receipt: DataReceipt } | { status: "unknown" } | { status: "rejected" }

function readReceipt(value: unknown, command: DataCommand, userId: string): DataReceipt | null {
  const result = dataReceiptSchema.safeParse(value)
  if (!result.success) return null
  const receipt = result.data
  const rowSchema = command.action.startsWith("vehicle.")
    ? vehicleSchema
    : command.action.startsWith("maintenance.")
      ? recordSchema
      : scheduledSchema
  if (
    !rowSchema.safeParse(receipt.row).success ||
    receipt.operation_id !== command.operationId ||
    receipt.action !== command.action ||
    receipt.row.id !== command.id ||
    receipt.row.user_id !== userId
  )
    return null
  return receipt
}
export function isConfirmedRejection(error: { code: string } | null): boolean {
  return !!error && /^(22|23|42501|P0001|PGRST20[23])/.test(error.code)
}
export async function executeDataCommand(
  client: SupabaseClient<Database>,
  userId: string,
  input: DataCommand
): Promise<DataOutcome> {
  const command = dataCommandSchema.parse(input)
  try {
    const { data, error } = await client
      .rpc("mutate_data", {
        p_operation_id: command.operationId,
        p_action: command.action,
        p_id: command.id,
        p_values: command.values,
      })
      .abortSignal(AbortSignal.timeout(15000))
      .retry(false)
    const receipt = !error && readReceipt(data, command, userId)
    if (receipt) return { status: "success", receipt }
    if (isConfirmedRejection(error)) return { status: "rejected" }
  } catch {
    /* Cancellation or transport loss cannot prove rollback. */
  }
  return { status: "unknown" }
}
export async function queryDataOperation(
  client: SupabaseClient<Database>,
  userId: string,
  command: DataCommand
): Promise<DataOutcome> {
  try {
    const { data, error } = await client
      .rpc("get_data_operation", { p_operation_id: command.operationId })
      .abortSignal(AbortSignal.timeout(15000))
      .retry(false)
    const receipt = !error && readReceipt(data, command, userId)
    if (receipt) return { status: "success", receipt }
  } catch {
    /* Absence of a receipt is not evidence of rollback. */
  }
  return { status: "unknown" }
}
