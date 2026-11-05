import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

/** Stable owner/vehicle scope and order for #96's cursor pages. */
export function maintenanceHistoryQuery(client: SupabaseClient<Database>, userId: string, vehicleId?: string) {
  const query = client
    .from("maintenance_records")
    .select("*,vehicles(make,model,year)")
    .eq("user_id", userId)
    .order("service_date", { ascending: false })
    .order("id", { ascending: false })
  return vehicleId ? query.eq("vehicle_id", vehicleId) : query
}

/** #96 seam: replace history with scoped cursor pages and independent database totals.
 * Interactive screens consume the owner, never query their own competing snapshots.
 */
export async function readDataSnapshot(client: SupabaseClient<Database>, userId: string) {
  const signal = AbortSignal.timeout(15000)
  const [vehicles, history, schedules] = await Promise.all([
    client
      .from("vehicles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .abortSignal(signal)
      .retry(false),
    maintenanceHistoryQuery(client, userId).abortSignal(signal).retry(false),
    client
      .from("scheduled_services")
      .select("*,vehicles(make,model,year,license_plate,mileage)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("scheduled_date", { ascending: true, nullsFirst: true })
      .abortSignal(signal)
      .retry(false),
  ])
  if (vehicles.error || history.error || schedules.error || !vehicles.data || !history.data || !schedules.data)
    throw new Error("No se pudieron cargar los datos. Se conservan los últimos datos válidos.")
  return { vehicles: vehicles.data, maintenanceRecords: history.data, scheduledServices: schedules.data }
}
