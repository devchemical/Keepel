"use client"

/* eslint-disable eslint/no-shadow -- Form error state uses conventional naming. */

import type React from "react"

import { useState } from "react"
import { useData } from "@/contexts"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Loader2 } from "lucide-react"

import { MAINTENANCE_TYPES as maintenanceTypes } from "@/lib/data/maintenance-types"
import { scheduledServiceSchema } from "@/lib/data/scheduled-command"

interface ScheduleServiceDialogProps {
  children?: React.ReactNode
  vehicleId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ScheduleServiceDialog({
  children,
  vehicleId,
  open: controlledOpen,
  onOpenChange,
}: ScheduleServiceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { addScheduledServiceOptimistic } = useData()

  const [formData, setFormData] = useState({
    type: "",
    description: "",
    scheduled_date: "",
    scheduled_mileage: "",
    notes: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!vehicleId) {
        throw new Error("ID del vehículo no válido")
      }

      const parsed = scheduledServiceSchema.safeParse(formData)
      if (!parsed.success)
        throw new Error("Indica un tipo válido y al menos una fecha o un kilometraje válido mayor o igual a 0.")
      await addScheduledServiceOptimistic(vehicleId, parsed.data)

      setFormData({
        type: "",
        description: "",
        scheduled_date: "",
        scheduled_mileage: "",
        notes: "",
      })
      setOpen(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido al programar servicio"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Calendar className="text-primary h-5 w-5" />
            <span>Programar Servicio</span>
          </DialogTitle>
          <DialogDescription className="text-sm">Programa un mantenimiento futuro para tu vehículo.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="type" className="text-sm font-medium">
              Tipo de Servicio *
            </Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger id="type" className="h-10">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {maintenanceTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-medium">
              Descripción
            </Label>
            <Input
              id="description"
              placeholder="Detalles adicionales del servicio..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="scheduled_date" className="text-sm font-medium">
                Fecha Programada
              </Label>
              <Input
                id="scheduled_date"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheduled_mileage" className="text-sm font-medium">
                Kilometraje Programado
              </Label>
              <Input
                id="scheduled_mileage"
                type="number"
                placeholder="55000"
                value={formData.scheduled_mileage}
                onChange={(e) => setFormData({ ...formData, scheduled_mileage: e.target.value })}
                className="h-10"
              />
            </div>
          </div>

          <div className="border-border bg-muted/30 text-muted-foreground rounded-md p-2 text-xs">
            Indica al menos una fecha o un kilometraje para programar el servicio.
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notas
            </Label>
            <Textarea
              id="notes"
              placeholder="Información adicional..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="resize-none text-sm"
            />
            <p className="text-muted-foreground text-xs leading-5">
              Incluye solo información necesaria del vehículo. No introduzcas datos sensibles ni datos personales de
              terceras personas.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-2.5 text-xs sm:text-sm"
            >
              {error}
            </div>
          )}

          <div className="border-border flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-10 flex-1 sm:h-11">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.type}
              className="bg-primary hover:bg-primary/90 h-10 flex-1 font-medium sm:h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Programando...
                </>
              ) : (
                "Programar Servicio"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
