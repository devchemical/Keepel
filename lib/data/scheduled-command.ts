import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import type { Database } from "@/lib/supabase/database.types"
import {
  maintenanceTypeSchema,
  nullableTextSchema,
  nullableCalendarDaySchema,
  nullableMileageSchema,
} from "@/lib/data/maintenance-validation"

/** Complete editor values: blanks always clear to NULL; never use this as a sparse PATCH. */
export const scheduledServiceSchema = z
  .object({
    type: maintenanceTypeSchema,
    description: nullableTextSchema,
    scheduled_date: nullableCalendarDaySchema,
    scheduled_mileage: nullableMileageSchema,
    notes: nullableTextSchema,
  })
  .refine((value) => value.scheduled_date !== null || value.scheduled_mileage !== null, {
    message: "Debe indicar al menos una fecha o un kilometraje programado",
  })
export type ScheduledServiceValues = z.output<typeof scheduledServiceSchema>

export async function createScheduledService(
  client: SupabaseClient<Database>,
  userId: string,
  vehicleId: string,
  input: unknown
) {
  const values = scheduledServiceSchema.parse(input)
  const { data, error } = await client
    .from("scheduled_services")
    .insert({ ...values, user_id: userId, vehicle_id: vehicleId, status: "pending" })
    .select("*,vehicles(make,model,year,license_plate,mileage)")
    .single()
  if (error || !data)
    throw new Error("No se pudo confirmar el servicio programado. Comprueba los datos antes de repetir la operación.")
  return data
}

export async function updateScheduledService(
  client: SupabaseClient<Database>,
  userId: string,
  id: string,
  input: unknown
) {
  const values = scheduledServiceSchema.parse(input)
  const { data, error } = await client
    .from("scheduled_services")
    .update(values)
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("*,vehicles(make,model,year,license_plate,mileage)")
    .single()
  if (error || !data)
    throw new Error("No se pudo confirmar la actualización. Comprueba si la previsión sigue pendiente.")
  return data
}

export async function cancelScheduledService(client: SupabaseClient<Database>, userId: string, id: string) {
  const { data, error } = await client
    .from("scheduled_services")
    .update({ status: "cancelled", completed_record_id: null })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id,status")
    .single()
  if (error || !data || data.id !== id || data.status !== "cancelled")
    throw new Error("No se pudo confirmar la cancelación. Comprueba si la previsión sigue pendiente.")
}
