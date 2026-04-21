"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, Car } from "lucide-react"
import Link from "next/link"

interface MaintenanceRecord {
  id: string
  type: string
  cost?: number
  service_date: string
  vehicles: {
    make: string
    model: string
    year: number
  }
}

interface RecentActivityProps {
  maintenanceRecords: MaintenanceRecord[]
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

export function RecentActivity({ maintenanceRecords, isLoading }: RecentActivityProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-36" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="mt-2 h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-48" />
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
      year: "numeric",
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  if (maintenanceRecords.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-700" />
            Actividad Reciente
          </CardTitle>
          <CardDescription>No hay actividad reciente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <Activity className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <p className="mb-6 leading-relaxed text-slate-500">Aún no has registrado ningún mantenimiento</p>
            <Button variant="outline" asChild>
              <Link href="/vehicles">Agregar Mantenimiento</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-700" />
              Actividad Reciente
            </CardTitle>
            <CardDescription>Últimos {Math.min(maintenanceRecords.length, 5)} mantenimientos</CardDescription>
          </div>
          <Button variant="default" size="sm" className="bg-green-700 hover:bg-green-800" asChild>
            <Link href="/vehicles">Ver Todos</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {maintenanceRecords.slice(0, 5).map((record) => (
            <div
              key={record.id}
              className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 transition-colors hover:bg-slate-50/50"
            >
              <div className="rounded-xl bg-green-100 p-2.5">
                <Activity className="h-5 w-5 text-green-700" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">
                    {maintenanceTypes[record.type as keyof typeof maintenanceTypes] || record.type}
                  </span>
                  {record.cost && (
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-xs text-slate-600">
                      {formatCurrency(record.cost)}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Car className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {record.vehicles.make} {record.vehicles.model} {record.vehicles.year}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>{formatDate(record.service_date)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
