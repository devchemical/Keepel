// Example of updating a dialog component to use contexts
// This shows the pattern for migrating existing dialog components

"use client"

/* eslint-disable eslint/no-shadow -- Form error state is intentionally named `error` for UI clarity. */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuthProjection, useData } from "@/contexts"
import { AUTH_STATE_STATUS } from "@/lib/auth/contracts"

interface AddVehicleDialogContextProps {
  children: React.ReactNode
}

export function AddVehicleDialogContext({ children }: AddVehicleDialogContextProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use contexts instead of direct hooks
  const authState = useAuthProjection()
  const { addVehicleOptimistic } = useData()

  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    license_plate: "",
    vin: "",
    color: "",
    mileage: 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (authState.status !== AUTH_STATE_STATUS.AUTHENTICATED) return

    setIsLoading(true)
    setError(null)

    try {
      // Use optimistic update from context
      await addVehicleOptimistic({
        make: formData.make,
        model: formData.model,
        year: formData.year,
        license_plate: formData.license_plate || undefined,
        vin: formData.vin || undefined,
        color: formData.color || undefined,
        mileage: formData.mileage,
      })

      // Reset form and close dialog
      setFormData({
        make: "",
        model: "",
        year: new Date().getFullYear(),
        license_plate: "",
        vin: "",
        color: "",
        mileage: 0,
      })
      setOpen(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error al agregar vehículo")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Agregar Vehículo</DialogTitle>
          <DialogDescription>Completa la información de tu vehículo.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="make" className="text-sm font-medium">
                Marca *
              </Label>
              <Input
                id="make"
                value={formData.make}
                onChange={(e) => setFormData((prev) => ({ ...prev, make: e.target.value }))}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model" className="text-sm font-medium">
                Modelo *
              </Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                required
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="year" className="text-sm font-medium">
                Año *
              </Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))
                }
                required
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="license_plate" className="text-sm font-medium">
                Matrícula
              </Label>
              <Input
                id="license_plate"
                value={formData.license_plate}
                onChange={(e) => setFormData((prev) => ({ ...prev, license_plate: e.target.value }))}
                placeholder="ABC-1234"
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vin" className="text-sm font-medium">
                VIN
              </Label>
              <Input
                id="vin"
                value={formData.vin}
                onChange={(e) => setFormData((prev) => ({ ...prev, vin: e.target.value }))}
                placeholder="17 dígitos"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color" className="text-sm font-medium">
                Color
              </Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mileage" className="text-sm font-medium">
              Kilometraje Actual
            </Label>
            <Input
              id="mileage"
              type="number"
              value={formData.mileage}
              onChange={(e) => setFormData((prev) => ({ ...prev, mileage: parseInt(e.target.value) || 0 }))}
              placeholder="50000"
              className="h-10"
            />
          </div>

          {error && (
            <div className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-2.5 text-xs sm:text-sm">
              {error}
            </div>
          )}

          <div className="border-border flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              className="h-10 flex-1 sm:h-11"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="h-10 flex-1 sm:h-11">
              {isLoading ? "Agregando..." : "Agregar Vehículo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
