import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/lib/supabase/database.types"

export const HISTORY_PAGE_SIZE = 25
export type HistoryCursor = { service_date: string; id: string }
export type MaintenanceTotals = Database["public"]["Functions"]["maintenance_totals"]["Returns"][number]
const HISTORY_FIELDS =
  "id,user_id,vehicle_id,type,description,cost,mileage,service_date,notes,created_at,updated_at" as const

/** Lexicographic descending keyset: dates alone would skip tied records. */
export function maintenanceHistoryQuery(
  client: SupabaseClient<Database>,
  userId: string,
  vehicleId?: string,
  cursor?: HistoryCursor,
  limit = HISTORY_PAGE_SIZE
) {
  let query = client
    .from("maintenance_records")
    .select(HISTORY_FIELDS)
    .eq("user_id", userId)
    .order("service_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit)
  if (vehicleId) query = query.eq("vehicle_id", vehicleId)
  if (cursor)
    query = query.or(
      `service_date.lt.${cursor.service_date},and(service_date.eq.${cursor.service_date},id.lt.${cursor.id})`
    )
  return query
}

export async function readMaintenanceTotals(client: SupabaseClient<Database>, vehicleId?: string) {
  const result = await client
    .rpc("maintenance_totals", vehicleId ? { p_vehicle_id: vehicleId } : {})
    .abortSignal(AbortSignal.timeout(15000))
    .retry(false)
  if (result.error || !result.data?.[0]) throw new Error("No se pudieron cargar los totales")
  return result.data[0]
}

// Selectors and reminder counts require complete collections, even above the API cap.
// These scoped keyset scans are not another cache or a history snapshot.
async function readVehicles(client: SupabaseClient<Database>, userId: string, signal: AbortSignal) {
  const rows: Tables<"vehicles">[] = []
  let after: string | undefined
  for (;;) {
    let query = client
      .from("vehicles")
      .select("id,user_id,make,model,year,license_plate,vin,color,mileage,created_at,updated_at")
      .eq("user_id", userId)
      .order("id")
      .limit(500)
    if (after) query = query.gt("id", after)
    const result = await query.abortSignal(signal).retry(false)
    if (result.error || !result.data) throw new Error("No se pudieron cargar los vehículos")
    rows.push(...result.data)
    if (!result.data.length)
      return rows.toSorted((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.id.localeCompare(a.id))
    after = result.data.at(-1)?.id
  }
}
async function readSchedules(client: SupabaseClient<Database>, userId: string, signal: AbortSignal) {
  const rows: Tables<"scheduled_services">[] = []
  let after: string | undefined
  for (;;) {
    let query = client
      .from("scheduled_services")
      .select(
        "id,user_id,vehicle_id,type,description,scheduled_date,scheduled_mileage,status,notes,completed_record_id,created_at,updated_at"
      )
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("id")
      .limit(500)
    if (after) query = query.gt("id", after)
    const result = await query.abortSignal(signal).retry(false)
    if (result.error || !result.data) throw new Error("No se pudieron cargar los servicios")
    rows.push(...result.data)
    if (!result.data.length) return rows
    after = result.data.at(-1)?.id
  }
}

export async function readDataSnapshot(client: SupabaseClient<Database>, userId: string) {
  const signal = AbortSignal.timeout(15000)
  const [vehicles, history, scheduledServices, totals] = await Promise.all([
    readVehicles(client, userId, signal),
    maintenanceHistoryQuery(client, userId, undefined, undefined, 5).abortSignal(signal).retry(false),
    readSchedules(client, userId, signal),
    readMaintenanceTotals(client),
  ])
  if (history.error || !history.data) throw new Error("No se pudieron cargar los datos")
  return { vehicles, maintenanceRecords: history.data, scheduledServices, totals }
}
