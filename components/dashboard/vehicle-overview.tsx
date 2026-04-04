"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Car, Plus, Gauge } from "lucide-react"
import Link from "next/link"
import { formatMileage } from "@/lib/formatters"

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  license_plate?: string
  color?: string
  mileage: number
}

interface VehicleOverviewProps {
  vehicles: Vehicle[]
}

export function VehicleOverview({ vehicles }: VehicleOverviewProps) {
  if (vehicles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="text-primary h-5 w-5" />
            Mis Vehículos
          </CardTitle>
          <CardDescription>No tienes vehículos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <Car className="text-muted-foreground/30 mx-auto mb-4 h-12 w-12" />
            <p className="text-muted-foreground mb-6 leading-relaxed">Comienza agregando tu primer vehículo</p>
            <Button asChild>
              <Link href="/vehicles">
                <Plus className="mr-2 h-4 w-4" />
                Agregar Vehículo
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Car className="text-primary h-5 w-5" />
              Mis Vehículos
            </CardTitle>
            <CardDescription>
              {vehicles.length} vehículo{vehicles.length !== 1 ? "s" : ""} registrado{vehicles.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button variant="default" size="sm" className="w-full sm:w-auto" asChild>
            <Link href="/vehicles">Ver Todos</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {vehicles.slice(0, 3).map((vehicle) => (
            <div
              key={vehicle.id}
              className="border-border/50 bg-card hover:bg-accent/50 flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all duration-200 active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 rounded-xl p-2.5">
                  <Car className="text-primary h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate font-medium">
                    {vehicle.make} {vehicle.model}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="text-xs">
                      {vehicle.year}
                    </Badge>
                    {vehicle.license_plate && <span className="text-muted-foreground">{vehicle.license_plate}</span>}
                  </div>
                </div>
              </div>
              <div className="text-muted-foreground ml-2 flex items-center gap-2 text-sm">
                <Gauge className="text-muted-foreground/60 h-4 w-4" />
                <span className="whitespace-nowrap">{formatMileage(vehicle.mileage)}</span>
              </div>
            </div>
          ))}

          {vehicles.length > 3 && (
            <div className="pt-3 text-center">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/vehicles">
                  Ver {vehicles.length - 3} vehículo
                  {vehicles.length - 3 !== 1 ? "s" : ""} más
                </Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
