"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAnalytics } from "@/hooks/use-analytics"
import { useAuth, useSupabase, useData } from "@/contexts"
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
import { Wrench, Loader2, Plus, X } from "lucide-react"

interface AddMaintenanceDialogProps {
  children?: React.ReactNode
  vehicleId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface ServiceItem {
  id: string
  type: string
  description: string
  cost: string
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

export function AddMaintenanceDialog({ children, vehicleId, open: controlledOpen, onOpenChange }: AddMaintenanceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Usar contextos en lugar de crear cliente directamente
  const { user } = useAuth()
  const supabase = useSupabase()
  const { refreshMaintenance } = useData()
  const router = useRouter()
  const { trackMaintenanceAction } = useAnalytics()

  // Lista de servicios múltiples
  const [services, setServices] = useState<ServiceItem[]>([
    { id: crypto.randomUUID(), type: "", description: "", cost: "" },
  ])

  const [formData, setFormData] = useState({
    mileage: "",
    service_date: new Date().toISOString().split("T")[0],
    notes: "",
  })

  // Funciones para manejar múltiples servicios
  const addService = () => {
    setServices([...services, { id: crypto.randomUUID(), type: "", description: "", cost: "" }])
  }

  const removeService = (id: string) => {
    if (services.length > 1) {
      setServices(services.filter((s) => s.id !== id))
    }
  }

  const updateService = (id: string, field: keyof ServiceItem, value: string) => {
    setServices(services.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Validaciones básicas
      if (!vehicleId) {
        throw new Error("ID del vehículo no válido")
      }

      // Validar que al menos un servicio tiene tipo seleccionado
      const validServices = services.filter((s) => s.type)

      if (validServices.length === 0) {
        throw new Error("Debe seleccionar al menos un tipo de mantenimiento")
      }

      if (!user) {
        throw new Error("No hay sesión activa. Por favor, inicia sesión.")
      }

      // Track maintenance add attempt
      trackMaintenanceAction("add", vehicleId)

      // Validar números comunes
      const mileage = formData.mileage ? parseInt(formData.mileage, 10) : null

      if (formData.mileage && (isNaN(mileage!) || mileage! < 0)) {
        throw new Error("El kilometraje debe ser un número válido mayor o igual a 0")
      }

      // Preparar datos para inserción múltiple
      const maintenanceRecords = validServices.map((service) => {
        const cost = service.cost ? parseFloat(service.cost) : null

        // Validar costo
        if (service.cost && (isNaN(cost!) || cost! < 0)) {
          throw new Error(
            `El costo para ${maintenanceTypes.find((t) => t.value === service.type)?.label} debe ser un número válido`
          )
        }

        return {
          vehicle_id: vehicleId,
          user_id: user.id,
          type: service.type,
          description: service.description?.trim() || null,
          cost,
          mileage,
          service_date: formData.service_date,
          notes: formData.notes?.trim() || null,
        }
      })

      try {
        const { error, data } = await supabase.from("maintenance_records").insert(maintenanceRecords).select()

        if (error) {
          throw new Error(`Error al insertar: ${error.message}`)
        }

        // Track successful maintenance add
        trackMaintenanceAction("add", vehicleId)

        await refreshMaintenance()
        router.refresh()
      } catch (error) {
        throw error
      }

      // Reset form and close dialog
      setServices([{ id: crypto.randomUUID(), type: "", description: "", cost: "" }])
      setFormData({
        mileage: "",
        service_date: new Date().toISOString().split("T")[0],
        notes: "",
      })

      setOpen(false)
    } catch (error: unknown) {
      // Track error
      trackMaintenanceAction("add", vehicleId)
      const errorMessage = error instanceof Error ? error.message : "Error desconocido al agregar mantenimiento"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wrench className="text-primary h-5 w-5" />
            <span>Agregar Mantenimiento</span>
          </DialogTitle>
          <DialogDescription className="text-sm">
            Registra un nuevo servicio o mantenimiento realizado al vehículo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Información general */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="service_date" className="text-sm font-medium">
                Fecha de Servicio *
              </Label>
              <Input
                id="service_date"
                type="date"
                value={formData.service_date}
                onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mileage" className="text-sm font-medium">
                Kilometraje Actual
              </Label>
              <Input
                id="mileage"
                type="number"
                placeholder="50000"
                value={formData.mileage}
                onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                className="h-10"
              />
            </div>
          </div>

          {/* Sección de servicios múltiples */}
          <div className="border-border bg-muted/30 space-y-3 rounded-lg border p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Wrench className="h-4 w-4" />
                Servicios
              </h4>
              <Button type="button" size="sm" variant="outline" onClick={addService} className="h-8 gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>

            {services.map((service, index) => (
              <div key={service.id} className="border-border bg-background relative space-y-2.5 rounded-md border p-3">
                {services.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeService(service.id)}
                    className="text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 h-6 w-6 p-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Tipo {services.length > 1 ? `#${index + 1}` : ""} *</Label>
                  <Select value={service.type} onValueChange={(value) => updateService(service.id, "type", value)}>
                    <SelectTrigger className="h-9 text-sm">
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

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Descripción</Label>
                    <Input
                      placeholder="Marca, modelo..."
                      value={service.description}
                      onChange={(e) => updateService(service.id, "description", e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Costo (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={service.cost}
                      onChange={(e) => updateService(service.id, "cost", e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
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
          </div>

          {error && (
            <div className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-2.5 text-xs sm:text-sm">
              {error}
            </div>
          )}

          {/* Botones optimizados para touch */}
          <div className="border-border flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-10 flex-1 sm:h-11">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || services.every((s) => !s.type)}
              className="bg-primary hover:bg-primary/90 h-10 flex-1 font-medium sm:h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                `Agregar ${services.filter((s) => s.type).length > 1 ? "Servicios" : "Mantenimiento"}`
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
