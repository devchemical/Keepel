"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, AlertTriangle, CheckCircle, Car } from "lucide-react"
import Link from "next/link"

interface UpcomingMaintenanceRecord {
  id: string
  type: string
  scheduled_date?: string
  scheduled_mileage?: number
  status: string
  vehicles?: {
    make: string
    model: string
    year: number
    license_plate?: string
  }
}

interface UpcomingMaintenanceProps {
  upcomingMaintenance: UpcomingMaintenanceRecord[]
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

export function UpcomingMaintenance({ upcomingMaintenance, isLoading }: UpcomingMaintenanceProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="mt-2 h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 rounded-xl border p-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    })
  }

  const isOverdue = (dateString: string) => {
    return new Date(dateString) < new Date()
  }

  const getDaysUntil = (dateString: string) => {
    const today = new Date()
    const serviceDate = new Date(dateString)
    const diffTime = serviceDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (upcomingMaintenance.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-700" />
            Próximos Mantenimientos
          </CardTitle>
          <CardDescription>No hay servicios programados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-700" />
            <p className="leading-relaxed text-slate-500">
              ¡Perfecto! No tienes mantenimientos pendientes en los próximos 30 días.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-green-700" />
          Próximos Mantenimientos
        </CardTitle>
        <CardDescription>
          {upcomingMaintenance.length} servicio{upcomingMaintenance.length !== 1 ? "s" : ""} programado
          {upcomingMaintenance.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingMaintenance.slice(0, 5).map((maintenance) => {
            const scheduledDate = maintenance.scheduled_date || ""
            const daysUntil = scheduledDate ? getDaysUntil(scheduledDate) : null
            const overdue = scheduledDate ? isOverdue(scheduledDate) : false

            return (
              <div
                key={maintenance.id}
                className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-4 transition-colors hover:bg-slate-50/50"
              >
                <div className={`rounded-xl p-2.5 ${overdue ? "bg-red-50" : "bg-amber-50"}`}>
                  {overdue ? (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  ) : (
                    <Calendar className="h-5 w-5 text-amber-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {maintenanceTypes[maintenance.type as keyof typeof maintenanceTypes] || maintenance.type}
                    </span>
                    <Badge
                      variant={overdue ? "destructive" : "secondary"}
                      className={`border-0 text-xs ${overdue ? "" : "bg-amber-100 text-amber-700"}`}
                    >
                      {overdue ? "Vencido" : daysUntil !== null ? `${daysUntil} días` : "Programado"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Car className="h-3.5 w-3.5 text-slate-400" />
                    {maintenance.vehicles && (
                      <span>
                        {maintenance.vehicles.make} {maintenance.vehicles.model} {maintenance.vehicles.year}
                        {maintenance.vehicles.license_plate && <span className="text-slate-300"> •</span>}
                        {maintenance.vehicles.license_plate && <span> {maintenance.vehicles.license_plate}</span>}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 text-xs text-slate-500">
                      {scheduledDate && formatDate(scheduledDate)}
                      {maintenance.scheduled_mileage && (
                        <span> &middot; {maintenance.scheduled_mileage.toLocaleString("es-ES")} km</span>
                      )}
                    </div>
                </div>
              </div>
            )
          })}

          {upcomingMaintenance.length > 5 && (
            <div className="pt-3 text-center">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/vehicles">Ver {upcomingMaintenance.length - 5} más</Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
