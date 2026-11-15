"use client"

import { useEffect } from "react"
import { formatCurrency } from "@/lib/formatters"
import { useData } from "@/contexts"
import { DataRecovery } from "@/components/data/data-recovery"
import { MaintenanceList } from "@/components/maintenance/maintenance-list"
import { AddMaintenanceDialog } from "@/components/maintenance/add-maintenance-dialog"
import { MaintenanceActionsDropdown } from "@/components/maintenance/maintenance-actions-dropdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Car, Plus, Wrench, Gauge } from "lucide-react"
import Link from "next/link"
import { snapshotView } from "@/lib/data/snapshot-machine"
import { MaintenanceSkeleton } from "@/components/skeletons/maintenance-skeleton"
import { VehicleDetailSkeleton } from "@/components/skeletons/vehicle-detail-skeleton"

export function VehicleHistoryScreen({ id }: { id: string }) {
  const { vehicles, history, selectHistory, changeHistoryPage, snapshot, isLoading } = useData()
  const hasContent = snapshotView(snapshot) === "content"
  useEffect(() => {
    selectHistory(id)
    return () => selectHistory()
  }, [id, selectHistory])
  const currentHistory = history?.vehicleId === id ? history : null
  const vehicle = vehicles.find((row) => row.id === id)
  const maintenanceRecords = currentHistory?.records ?? []
  if (!hasContent || !vehicle)
    return (
      <div className="container mx-auto px-4 py-8" data-snapshot-status={snapshot.status}>
        <DataRecovery />
        {isLoading ? (
          <VehicleDetailSkeleton className="px-0 py-0" />
        ) : hasContent ? (
          <p>
            Vehículo no disponible. <Link href="/vehicles">Volver a Vehículos</Link>
          </p>
        ) : null}
      </div>
    )
  return (
    <div className="container mx-auto px-4 py-8" data-snapshot-status={snapshot.status}>
      <DataRecovery />
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
                      {vehicle.mileage?.toLocaleString("es-ES") ?? "—"} km
                    </span>
                  </CardDescription>
                </div>
              </div>

              {/* Acciones: Registrar o Programar */}
              <div className="border-border/50 flex justify-end border-t pt-2">
                <MaintenanceActionsDropdown vehicleId={id} />
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
          <p className="text-muted-foreground mt-1">
            {currentHistory ? currentHistory.totals.record_count : "—"} registro(s) de mantenimiento
          </p>
        </div>
      </div>

      {currentHistory && (
        <p className="text-muted-foreground mb-4">Gasto total: {formatCurrency(currentHistory.totals.total_cost)}</p>
      )}
      {!currentHistory && isLoading && <MaintenanceSkeleton />}
      <MaintenanceList records={maintenanceRecords} vehicleId={id} />
      {/* An empty first page has nothing to page through; the empty state below says so. */}
      {currentHistory && !(currentHistory.page === 1 && currentHistory.totals.record_count === 0) && (
        <nav
          aria-label="Paginación del historial"
          className="my-6 flex flex-wrap items-center justify-center gap-4"
          aria-busy={isLoading}
        >
          <Button
            variant="outline"
            disabled={isLoading || currentHistory.page <= 1}
            onClick={() => changeHistoryPage("previous")}
          >
            Página anterior
          </Button>
          <span role="status">Página {currentHistory.page}</span>
          <Button
            variant="outline"
            disabled={isLoading || !currentHistory.hasNext}
            onClick={() => changeHistoryPage("next")}
          >
            Página siguiente
          </Button>
        </nav>
      )}
      {currentHistory && currentHistory.totals.record_count === 0 && (
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
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 h-auto min-h-10 w-full py-2.5 whitespace-normal sm:w-auto"
              >
                <Plus className="mr-2 h-5 w-5" />
                Agregar Primer Mantenimiento
              </Button>
            </AddMaintenanceDialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
