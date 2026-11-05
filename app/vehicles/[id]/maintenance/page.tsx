import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { VehicleHistoryScreen } from "@/components/maintenance/vehicle-history-screen"

export default async function VehicleMaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) redirect("/auth/login")
  return <VehicleHistoryScreen id={id} />
}
