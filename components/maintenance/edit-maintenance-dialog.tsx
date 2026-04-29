"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useData } from "@/contexts"
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
  description?: string
  cost?: number
  mileage?: number
  service_date: string
  notes?: string
}

interface EditMaintenanceDialogProps {
  record: MaintenanceRecord
  vehicleId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const maintenanceTypes = [
  { value: "oil_change", label: "Cambio de Aceite" },
  { value: "tire_rotation", label: "Rotación de Llantas" },
  { value: "brake_service", label: "Servicio de Frenos" },
  { value: "transmission", label: "Transmisión" },
  { value: "engine_tune", label: "Afinación del Motor" },
  { value: "battery", label: "Batería" },
  { value: "air_filter", label: "Filtro de Aire" },
  { value: "coolant", label: "Refrigerante" },
  { value: "spark_plugs", label: "Bujías" },
  { value: "belts_hoses", label: "Correas y Mangueras" },
  { value: "suspension", label: "Suspensión" },
  { value: "exhaust", label: "Sistema de Escape" },
  { value: "other", label: "Otro" },
]

export function EditMaintenanceDialog({ record, vehicleId, open, onOpenChange }: EditMaintenanceDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingStep, setLoadingStep] = useState<string>("")

  const supabase = useSupabase()
  const { refreshMaintenance } = useData()
  const router = useRouter()

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setLoadingStep("Iniciando...")

    try {
      // Validaciones básicas
      if (!record?.id) {
        throw new Error("ID del registro no válido")
      }

      if (!vehicleId) {
        throw new Error("ID del vehículo no válido")
      }

      if (!formData.type) {
        throw new Error("Debe seleccionar un tipo de mantenimiento")
      }

      // RLS se encarga de verificar permisos automáticamente
      setLoadingStep("Preparando actualización...")

      // Preparar datos para actualización con validación de números
      const cost = formData.cost ? parseFloat(formData.cost) : null
      const mileage = formData.mileage ? parseInt(formData.mileage, 10) : null

      // Verificar que los números sean válidos si se proporcionaron
      if (formData.cost && (isNaN(cost!) || cost! < 0)) {
        throw new Error("El costo debe ser un número válido mayor o igual a 0")
      }

      if (formData.mileage && (isNaN(mileage!) || mileage! < 0)) {
        throw new Error("El kilometraje debe ser un número válido mayor o igual a 0")
      }

      const updateData = {
        type: formData.type,
        description: formData.description?.trim() || null,
        cost,
        mileage,
        service_date: formData.service_date,
        notes: formData.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      }

      // Actualizar el registro con timeout
      setLoadingStep("Actualizando registro de mantenimiento...")
      const updatePromise = supabase.from("maintenance_records").update(updateData).eq("id", record.id)

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("La operación tardó demasiado tiempo. Inténtalo de nuevo.")), 10000)
      })

      const { error: updateError } = (await Promise.race([updatePromise, timeoutPromise])) as any

      if (updateError) {
        throw new Error(`Error al actualizar: ${updateError.message}`)
      }

      setLoadingStep("Finalizando...")
      onOpenChange(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido al actualizar mantenimiento"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
      setLoadingStep("")

      // Recargar datos tanto del contexto como de la ruta actual
      refreshMaintenance().catch((err) => {
        console.error("Error al refrescar (no crítico):", err)
      })
      router.refresh()
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Mantenimiento *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
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
            <div className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-3 text-sm">
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
        </form>
      </DialogContent>
    </Dialog>
  )
}
