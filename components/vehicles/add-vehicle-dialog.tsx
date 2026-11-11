"use client"

import { vehicleValuesSchema } from "@/lib/data/data-command"
import type React from "react"

import { useState } from "react"
import { OperationRecovery } from "@/components/data/operation-recovery"
import { useData } from "@/contexts"
import { useEditor } from "@/hooks/use-editor"
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
  const { createVehicle } = useData()

  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: "",
    license_plate: "",
    vin: "",
    color: "",
    mileage: "",
  })

  const resetDraft = () =>
    setFormData({
      make: "",
      model: "",
      year: "",
      license_plate: "",
      vin: "",
      color: "",
      mileage: "",
    })

  const editor = useEditor({
    kind: "crud",
    action: "vehicle.create",
    onConfirmed: resetDraft,
    failureMessage: "Error al agregar vehículo",
  })
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void editor.submit(() => {
      const parsed = vehicleValuesSchema.safeParse(formData)
      if (!parsed.success)
        return { invalid: "Indica marca, modelo, un año válido y kilometraje entero mayor o igual a 0." }
      return { send: () => createVehicle(parsed.data) }
    })
  }

  return (
    <Dialog open={editor.open} onOpenChange={editor.setOpen}>
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

        <form onSubmit={handleSubmit} className="space-y-4" data-editor-state={editor.state.status}>
          <OperationRecovery />
          <fieldset disabled={editor.frozen || editor.submitting} className="space-y-4">
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
                  <SelectTrigger id="year" disabled={editor.frozen || editor.submitting}>
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
                  <SelectTrigger id="color" disabled={editor.frozen || editor.submitting}>
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

            {editor.error && (
              <div
                role="alert"
                className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-3 text-sm"
              >
                {editor.error}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={editor.submitting}
                onClick={() => editor.setOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={editor.submitting} className="bg-primary hover:bg-primary/90 flex-1">
                {editor.submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Agregar Vehículo
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
