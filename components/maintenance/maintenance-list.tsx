"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Calendar, DollarSign, Gauge, MoreVertical, Edit, Trash2, AlertCircle, CheckCircle } from "lucide-react"
import { EditMaintenanceDialog } from "./edit-maintenance-dialog"
import { DeleteMaintenanceDialog } from "./delete-maintenance-dialog"
import { useState } from "react"
import { MaintenanceSkeleton } from "@/components/skeletons/maintenance-skeleton"

interface MaintenanceRecord {
  id: string
  type: string
  description?: string
  cost?: number
  mileage?: number
  service_date: string
  next_service_date?: string
  next_service_mileage?: number
  notes?: string
  created_at: string
}

interface MaintenanceListProps {
  records: MaintenanceRecord[]
  vehicleId: string
  isLoading?: boolean
}

const maintenanceTypes = {
  oil_change: "Cambio de Aceite",
  tire_rotation: "Rotación de Llantas",
  brake_service: "Servicio de Frenos",
  transmission: "Transmisión",
  engine_tune: "Afinación del Motor",
  battery: "Batería",
  air_filter: "Filtro de Aire",
  coolant: "Refrigerante",
  spark_plugs: "Bujías",
  belts_hoses: "Correas y Mangueras",
  suspension: "Suspensión",
  exhaust: "Sistema de Escape",
  other: "Otro",
}

export function MaintenanceList({ records, vehicleId, isLoading }: MaintenanceListProps) {
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null)
  const [deletingRecord, setDeletingRecord] = useState<MaintenanceRecord | null>(null)

  if (isLoading) {
    return <MaintenanceSkeleton />
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  const isOverdue = (nextServiceDate?: string) => {
    if (!nextServiceDate) return false
    return new Date(nextServiceDate) < new Date()
  }

  const isUpcoming = (nextServiceDate?: string) => {
    if (!nextServiceDate) return false
    const nextDate = new Date(nextServiceDate)
    const today = new Date()
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    return nextDate >= today && nextDate <= thirtyDaysFromNow
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <Card key={record.id} className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-lg p-2">
                  <Calendar className="text-primary h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-foreground text-lg">
                    {maintenanceTypes[record.type as keyof typeof maintenanceTypes] || record.type}
                  </CardTitle>
                  <p className="text-muted-foreground text-sm">{formatDate(record.service_date)}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditingRecord(record)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeletingRecord(record)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {record.description && <p className="text-foreground text-sm">{record.description}</p>}

            <div className="flex flex-wrap gap-4 text-sm">
              {record.cost && (
                <div className="flex items-center gap-2">
                  <DollarSign className="text-muted-foreground h-4 w-4" />
                  <span className="text-foreground font-medium">{formatCurrency(record.cost)}</span>
                </div>
              )}
              {record.mileage && (
                <div className="flex items-center gap-2">
                  <Gauge className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground">{record.mileage.toLocaleString("es-ES")} km</span>
                </div>
              )}
            </div>

            {(record.next_service_date || record.next_service_mileage) && (
              <div className="border-border border-t pt-3">
                <h4 className="text-foreground mb-2 text-sm font-medium">Próximo Servicio:</h4>
                <div className="flex flex-wrap gap-2">
                  {record.next_service_date && (
                    <Badge
                      variant={
                        isOverdue(record.next_service_date)
                          ? "destructive"
                          : isUpcoming(record.next_service_date)
                            ? "warning"
                            : "success"
                      }
                      className="flex items-center gap-1"
                    >
                      {isOverdue(record.next_service_date) ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : isUpcoming(record.next_service_date) ? (
                        <Calendar className="h-3 w-3" />
                      ) : (
                        <CheckCircle className="h-3 w-3" />
                      )}
                      {formatDate(record.next_service_date)}
                    </Badge>
                  )}
                  {record.next_service_mileage && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Gauge className="h-3 w-3" />
                      {record.next_service_mileage.toLocaleString("es-ES")} km
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {record.notes && (
              <div className="border-border border-t pt-3">
                <h4 className="text-foreground mb-1 text-sm font-medium">Notas:</h4>
                <p className="text-muted-foreground text-sm">{record.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {editingRecord && (
        <EditMaintenanceDialog
          record={editingRecord}
          vehicleId={vehicleId}
          open={!!editingRecord}
          onOpenChange={(open) => !open && setEditingRecord(null)}
        />
      )}

      {deletingRecord && (
        <DeleteMaintenanceDialog
          record={deletingRecord}
          open={!!deletingRecord}
          onOpenChange={(open) => !open && setDeletingRecord(null)}
        />
      )}
    </div>
  )
}
