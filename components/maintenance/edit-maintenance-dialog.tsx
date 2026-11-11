"use client"

import { MAINTENANCE_TYPES as maintenanceTypes } from "@/lib/data/maintenance-types"

/* eslint-disable eslint/no-shadow -- The caught error is rendered by the form error state. */

import { maintenanceValuesSchema } from "@/lib/data/data-command"
import type React from "react"

import { useState, useEffect } from "react"
import { OperationRecovery, usePendingDataOperation } from "@/components/data/operation-recovery"
import { useData } from "@/contexts"
import { operationMessage } from "@/lib/data/operation-messages"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Wrench, Loader2 } from "lucide-react"

interface MaintenanceRecord {
  id: string
  type: string
  description?: string | null
  cost?: number | null
  mileage?: number | null
  service_date: string
  notes?: string | null
}

interface EditMaintenanceDialogProps {
  record: MaintenanceRecord
  vehicleId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditMaintenanceDialog({ record, vehicleId, open, onOpenChange }: EditMaintenanceDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { updateMaintenance } = useData()

  const [formData, setFormData] = useState({
    type: record.type,
    description: record.description || "",
    cost: record.cost?.toString() || "",
    mileage: record.mileage?.toString() || "",
    service_date: record.service_date,
    notes: record.notes || "",
  })

  useEffect(() => {
    setFormData({
      type: record.type,
      description: record.description || "",
      cost: record.cost?.toString() || "",
      mileage: record.mileage?.toString() || "",
      service_date: record.service_date,
      notes: record.notes || "",
    })
  }, [record])

  const pending = usePendingDataOperation(() => {
    setError(null)
    onOpenChange(false)
  })
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (!vehicleId) throw new Error("Vehículo no válido")
      const parsed = maintenanceValuesSchema.safeParse(formData)
      if (!parsed.success)
        throw new Error(
          "Revisa el tipo, la fecha, el costo y el kilometraje. Los números deben ser mayores o iguales a 0."
        )
      const message = operationMessage("crud", await updateMaintenance(record.id, parsed.data))
      if (message) {
        setError(message)
        return
      }

      onOpenChange(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido al actualizar mantenimiento"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="text-primary h-5 w-5" />
            Editar Registro de Mantenimiento
          </DialogTitle>
          <DialogDescription>Actualiza la información del registro de mantenimiento.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <OperationRecovery />
          <fieldset disabled={pending || isLoading} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Mantenimiento *</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger disabled={pending || isLoading}>
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
              <div className="space-y-2">
                <Label htmlFor="service_date">Fecha de Servicio *</Label>
                <Input
                  id="service_date"
                  type="date"
                  value={formData.service_date}
                  onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                placeholder="Descripción breve del servicio realizado"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Costo (€)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mileage">Kilometraje</Label>
                <Input
                  id="mileage"
                  type="number"
                  placeholder="50000"
                  value={formData.mileage}
                  onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas Adicionales</Label>
              <Textarea
                id="notes"
                placeholder="Cualquier información adicional sobre el servicio..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-3 text-sm"
              >
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !formData.type}
                className="bg-primary hover:bg-primary/90 flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Actualizar Mantenimiento"
                )}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
