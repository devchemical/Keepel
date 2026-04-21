"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Car, MoreVertical, Edit, Trash2, Calendar, Gauge } from "lucide-react"
import { EditVehicleDialog } from "./edit-vehicle-dialog"
import { DeleteVehicleDialog } from "./delete-vehicle-dialog"
import { useState } from "react"
import Link from "next/link"
import { formatMileage } from "@/lib/formatters"
import { VehiclesSkeleton } from "@/components/skeletons/vehicles-skeleton"

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  license_plate?: string
  vin?: string
  color?: string
  mileage: number
  created_at: string
  updated_at: string
}

interface VehiclesListProps {
  vehicles: Vehicle[]
  isLoading?: boolean
}

export function VehiclesList({ vehicles, isLoading }: VehiclesListProps) {
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null)

  if (isLoading) {
    return <VehiclesSkeleton />
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((vehicle) => (
        <Card key={vehicle.id} className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Car className="text-primary h-5 w-5" />
                <CardTitle className="text-foreground text-lg">
                  {vehicle.make} {vehicle.model}
                </CardTitle>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="cursor-pointer" onClick={() => setEditingVehicle(vehicle)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link href={`/vehicles/${vehicle.id}/maintenance`}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Ver Mantenimientos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeletingVehicle(vehicle)}
                    className="text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Badge variant="secondary" className="w-fit">
              {vehicle.year}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {vehicle.color && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <div
                  className="border-border h-4 w-4 rounded-full border"
                  style={{ backgroundColor: vehicle.color.toLowerCase() }}
                />
                <span className="capitalize">{vehicle.color}</span>
              </div>
            )}

            {vehicle.license_plate && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-foreground font-medium">Placa:</span>
                <Badge variant="outline">{vehicle.license_plate}</Badge>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Gauge className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">Kilometraje:</span>
              <span className="text-foreground font-medium">{formatMileage(vehicle.mileage)}</span>
            </div>

            {vehicle.vin && (
              <div className="text-muted-foreground text-xs">
                <span className="font-medium">VIN:</span> {vehicle.vin}
              </div>
            )}

            <div className="pt-2">
              <Button asChild size="sm" className="bg-primary hover:bg-primary/90 w-full">
                <Link href={`/vehicles/${vehicle.id}/maintenance`}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Ver Mantenimientos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {editingVehicle && (
        <EditVehicleDialog
          vehicle={editingVehicle}
          open={!!editingVehicle}
          onOpenChange={(open) => !open && setEditingVehicle(null)}
        />
      )}

      {deletingVehicle && (
        <DeleteVehicleDialog
          vehicle={deletingVehicle}
          open={!!deletingVehicle}
          onOpenChange={(open) => !open && setDeletingVehicle(null)}
        />
      )}
    </div>
  )
}
