"use client"

/* eslint-disable no-console, eslint/no-shadow -- Refresh failures are diagnostic only and form error state uses conventional naming. */

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAnalytics } from "@/hooks/use-analytics"
import { useSupabase, useData, useAuthProjection } from "@/contexts"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Car, Loader2 } from "lucide-react"
import { AUTH_STATE_STATUS } from "@/lib/auth/contracts"

interface AddVehicleDialogProps {
  children: React.ReactNode
}

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 50 }, (_, i) => currentYear - i)

const colors = [
  "Blanco",
  "Negro",
  "Gris",
  "Plata",
  "Azul",
  "Rojo",
  "Verde",
  "Amarillo",
  "Naranja",
  "Morado",
  "Café",
  "Beige",
]

export function AddVehicleDialog({ children }: AddVehicleDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authState = useAuthProjection()
  const supabase = useSupabase()
  const { refreshVehicles } = useData()
  const router = useRouter()
  const { trackVehicleAction } = useAnalytics()

  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: "",
    license_plate: "",
    vin: "",
    color: "",
    mileage: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (authState.status !== AUTH_STATE_STATUS.AUTHENTICATED) throw new Error("Usuario no autenticado")

      const userId = authState.user.id

      // Track vehicle add attempt
      trackVehicleAction("add")

      const { error, data } = await supabase
        .from("vehicles")
        .insert({
          user_id: userId,
          make: formData.make,
          model: formData.model,
          year: Number.parseInt(formData.year),
          license_plate: formData.license_plate || null,
          vin: formData.vin || null,
          color: formData.color || null,
          mileage: Number.parseInt(formData.mileage) || 0,
        })
        .select()

      if (error) throw error

      // Track successful vehicle add
      trackVehicleAction("add", data?.[0]?.id)

      setOpen(false)
      setFormData({
        make: "",
        model: "",
        year: "",
        license_plate: "",
        vin: "",
        color: "",
        mileage: "",
      })
    } catch (error: unknown) {
      // Track error
      trackVehicleAction("add")
      setError(error instanceof Error ? error.message : "Error al agregar vehículo")
    } finally {
      setIsLoading(false)
      refreshVehicles().catch((err) => console.error("Error al refrescar:", err))
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="text-primary h-5 w-5" />
            Agregar Nuevo Vehículo
          </DialogTitle>
          <DialogDescription>
            Ingresa la información de tu vehículo para comenzar a gestionar su mantenimiento.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="make">Marca *</Label>
              <Input
                id="make"
                placeholder="Toyota, Honda, Ford..."
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo *</Label>
              <Input
                id="model"
                placeholder="Corolla, Civic, Focus..."
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Año *</Label>
              <Select value={formData.year} onValueChange={(value) => setFormData({ ...formData, year: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar color" />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => (
                    <SelectItem key={color} value={color}>
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="license_plate">Placa</Label>
            <Input
              id="license_plate"
              placeholder="ABC-123"
              value={formData.license_plate}
              onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mileage">Kilometraje Actual</Label>
            <Input
              id="mileage"
              type="number"
              placeholder="50000"
              value={formData.mileage}
              onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vin">VIN (Opcional)</Label>
            <Input
              id="vin"
              placeholder="1HGBH41JXMN109186"
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
            />
          </div>

          {error && (
            <div className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 flex-1">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agregar Vehículo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
