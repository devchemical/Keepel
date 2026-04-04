import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { VehiclesList } from "@/components/vehicles/vehicles-list"
import { AddVehicleDialog } from "@/components/vehicles/add-vehicle-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Car, Plus } from "lucide-react"
import { Layout } from "../../components/layout/Layout"

// Force dynamic rendering para páginas que usan Supabase
export const dynamic = "force-dynamic"

export default async function VehiclesPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Fetch user's vehicles
  const { data: vehicles, error: vehiclesError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false })

  return (
    <Layout showHeader={true}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-foreground flex items-center gap-2 text-3xl font-bold">Mis Vehículos</h1>
          <p className="text-muted-foreground mt-2">Gestiona todos tus vehículos desde aquí</p>
        </div>

        {vehicles && vehicles.length > 0 ? (
          <>
            <VehiclesList vehicles={vehicles} />
            <div className="mt-6">
              <AddVehicleDialog>
                <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Vehículo
                </Button>
              </AddVehicleDialog>
            </div>
          </>
        ) : (
          <Card className="py-12 text-center">
            <CardHeader>
              <div className="mb-4 flex justify-center">
                <div className="bg-muted rounded-full p-4">
                  <Car className="text-muted-foreground h-12 w-12" />
                </div>
              </div>
              <CardTitle className="text-foreground text-2xl">No tienes vehículos registrados</CardTitle>
              <CardDescription className="text-lg">
                Comienza agregando tu primer vehículo para llevar un control de su mantenimiento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddVehicleDialog>
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  <Plus className="mr-2 h-5 w-5" />
                  Agregar Mi Primer Vehículo
                </Button>
              </AddVehicleDialog>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  )
}
