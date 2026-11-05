import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { VehiclesScreen } from "@/components/vehicles/vehicles-screen"

export const dynamic = "force-dynamic"
export default async function VehiclesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) redirect("/auth/login")
  return <VehiclesScreen />
}
