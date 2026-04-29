import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MaintenanceList } from "@/components/maintenance/maintenance-list"
import { AddMaintenanceDialog } from "@/components/maintenance/add-maintenance-dialog"
import { ScheduleServiceDialog } from "@/components/maintenance/schedule-service-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, Car, Plus, Wrench, Gauge, Calendar, ChevronDown } from "lucide-react"
import Link from "next/link"
import { Layout } from "../../../../components/layout/Layout"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function VehicleMaintenancePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Fetch vehicle details
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .eq("user_id", data.user.id)
    .single()

  if (vehicleError || !vehicle) {
    redirect("/vehicles")
  }

  // Fetch maintenance records
  const { data: maintenanceRecords, error: maintenanceError } = await supabase
    .from("maintenance_records")
    .select("*")
    .eq("vehicle_id", id)
    .eq("user_id", data.user.id)
    .order("service_date", { ascending: false })

  return (
    <Layout showHeader={true}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/vehicles" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver a Vehículos
            </Link>
          </Button>

          <Card className="mb-6">
            <CardHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Car className="text-primary h-6 w-6" />
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-2xl">
                      {vehicle.make} {vehicle.model}
                    </CardTitle>
                    <CardDescription className="mt-1 flex flex-wrap items-center gap-2 sm:gap-4">
                      <Badge variant="secondary">{vehicle.year}</Badge>
                      {vehicle.license_plate && <span className="text-sm">Placa: {vehicle.license_plate}</span>}
                      <span className="flex items-center gap-1 text-sm">
                        <Gauge className="h-4 w-4" />
                        {vehicle.mileage.toLocaleString("es-ES")} km
                      </span>
                    </CardDescription>
                  </div>
                </div>

                {/* Acciones: Registrar o Programar */}
                <div className="border-border/50 flex justify-end border-t pt-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Agregar</span>
                        <span className="sm:hidden">Agregar</span>
                        <ChevronDown className="ml-1 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <AddMaintenanceDialog vehicleId={id}>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Wrench className="mr-2 h-4 w-4" />
                          Registrar Mantenimiento
                        </DropdownMenuItem>
                      </AddMaintenanceDialog>
                      <ScheduleServiceDialog vehicleId={id}>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onSelect={(e) => e.preventDefault()}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Programar Servicio
                        </DropdownMenuItem>
                      </ScheduleServiceDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-foreground flex items-center gap-2 text-2xl font-bold">
              <Wrench className="text-primary h-6 w-6" />
              Historial de Mantenimiento
            </h2>
            <p className="text-muted-foreground mt-1">{maintenanceRecords?.length || 0} registro(s) de mantenimiento</p>
          </div>
        </div>

        {maintenanceRecords && maintenanceRecords.length > 0 ? (
          <MaintenanceList records={maintenanceRecords} vehicleId={id} />
        ) : (
          <Card className="py-12 text-center">
            <CardHeader>
              <div className="mb-4 flex justify-center">
                <div className="bg-muted rounded-full p-4">
                  <Wrench className="text-muted-foreground h-12 w-12" />
                </div>
              </div>
              <CardTitle className="text-foreground text-2xl">No hay registros de mantenimiento</CardTitle>
              <CardDescription className="text-lg">
                Comienza agregando el primer registro de mantenimiento para este vehículo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddMaintenanceDialog vehicleId={id}>
                <Button size="lg" className="bg-primary hover:bg-primary/90">
                  <Plus className="mr-2 h-5 w-5" />
                  Agregar Primer Mantenimiento
                </Button>
              </AddMaintenanceDialog>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  )
}
