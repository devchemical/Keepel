"use client"

/* eslint-disable eslint/no-shadow, typescript/no-non-null-assertion, unicorn/consistent-function-scoping -- Form error state uses conventional naming; numeric validations guard non-null assertions; temp id helper stays local. */

import type React from "react"

import { useRef, useState } from "react"
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
import { Wrench, Loader2, Plus, X } from "lucide-react"
import { localToday } from "@/lib/data/calendar-day"
import { MAINTENANCE_TYPES as maintenanceTypes } from "@/lib/data/maintenance-types"
import { maintenanceBatchSchema, isEmptyMaintenanceRow } from "@/lib/data/maintenance-validation"
import { maintenanceCommandSchema, type MaintenanceCommand } from "@/lib/data/maintenance-command"

interface AddMaintenanceDialogProps {
  children?: React.ReactNode
  vehicleId: string
  initialScheduledServiceId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface ServiceItem {
  id: string
  type: string
  description: string
  cost: string
}

export function AddMaintenanceDialog({
  children,
  vehicleId,
  initialScheduledServiceId,
  open: controlledOpen,
  onOpenChange,
}: AddMaintenanceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Usar contextos en lugar de crear cliente directamente
  const {
    createMaintenanceBatch,
    reconcileMaintenanceBatch,
    scheduledServices,
    pendingOperations,
    operationStorageError,
  } = useData()
  const pendingOperation = pendingOperations.find(
    (operation) => operation.command.action === "maintenance.batch"
  )?.command
  const pendingBatch = pendingOperation?.action === "maintenance.batch" ? pendingOperation : null
  const [selectedSchedule, setSelectedSchedule] = useState(initialScheduledServiceId ?? "none")
  const [completionRowId, setCompletionRowId] = useState("")
  const submitting = useRef(false)
  const pendingSchedules = scheduledServices.filter(
    (service) => service.vehicle_id === vehicleId && service.status === "pending"
  )

  // Helper para generar IDs temporales compatibles con todos los navegadores
  const generateTempId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`

  // Lista de servicios múltiples
  const [services, setServices] = useState<ServiceItem[]>([
    { id: generateTempId(), type: "", description: "", cost: "" },
  ])

  const [formData, setFormData] = useState({
    mileage: "",
    service_date: localToday(),
    notes: "",
  })

  const displayedForm = pendingBatch
    ? {
        service_date: pendingBatch.batch.service_date,
        mileage: pendingBatch.batch.mileage === null ? "" : String(pendingBatch.batch.mileage),
        notes: pendingBatch.batch.notes ?? "",
      }
    : formData
  const displayedServices = pendingBatch
    ? pendingBatch.batch.services.map((row, index) => ({
        id: `pending-${index}`,
        type: row.type,
        description: row.description ?? "",
        cost: row.cost === null ? "" : String(row.cost),
      }))
    : services

  const displayedSchedule = pendingBatch ? (pendingBatch.completion?.scheduled_service_id ?? "none") : selectedSchedule
  const displayedCompletionRow = pendingBatch?.completion
    ? `pending-${pendingBatch.completion.service_index}`
    : completionRowId || services.find((row) => row.type)?.id || ""

  // Funciones para manejar múltiples servicios
  const addService = () => {
    setServices([...services, { id: generateTempId(), type: "", description: "", cost: "" }])
  }

  const removeService = (id: string) => {
    if (services.length > 1) {
      setServices(services.filter((s) => s.id !== id))
    }
  }

  const updateService = (id: string, field: keyof ServiceItem, value: string) => {
    setServices(services.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const save = async (reconcileOnly = false) => {
    if (submitting.current) return
    setError(null)
    let command: MaintenanceCommand | null = pendingBatch
    if (!command) {
      const parsed = maintenanceBatchSchema.safeParse({ ...formData, services })
      if (!parsed.success) {
        setError(
          parsed.error.issues
            .map((issue) => {
              const index = issue.path[0] === "services" && typeof issue.path[1] === "number" ? issue.path[1] : null
              return index !== null
                ? `Servicio #${index + 1}: revisa el tipo, la descripción y el costo.`
                : "Revisa la fecha, el kilometraje y los servicios."
            })
            .join(" ")
        )
        return
      }
      const nonemptyRows = services.filter((row) => !isEmptyMaintenanceRow(row))
      const selectedRow = completionRowId || services.find((row) => row.type)?.id
      const envelope = maintenanceCommandSchema.safeParse({
        operationId: crypto.randomUUID(),
        vehicleId,
        today: localToday(),
        batch: parsed.data,
        completion:
          selectedSchedule === "none"
            ? null
            : {
                scheduled_service_id: selectedSchedule,
                service_index: nonemptyRows.findIndex((row) => row.id === selectedRow),
              },
      })
      if (!envelope.success) {
        setError("Selecciona un servicio realizado y una fecha no futura para resolver la previsión.")
        return
      }
      command = envelope.data
    }
    submitting.current = true
    setIsLoading(true)
    try {
      const result = await (reconcileOnly ? reconcileMaintenanceBatch(command) : createMaintenanceBatch(command))
      if (result.status === "success") {
        setServices([{ id: generateTempId(), type: "", description: "", cost: "" }])
        setFormData({ mileage: "", service_date: localToday(), notes: "" })
        setSelectedSchedule("none")
        setCompletionRowId("")
        setOpen(false)
      } else if (result.status === "rejected") {
        setError("No se pudo guardar el mantenimiento. Revisa los datos y la sesión e inténtalo de nuevo.")
      } else {
        setError(
          "Resultado pendiente de confirmar. Comprueba el resultado o reintenta la misma operación; no se duplicarán los servicios."
        )
      }
    } catch {
      setError("Resultado pendiente de confirmar. Comprueba el resultado antes de crear otra operación.")
    } finally {
      submitting.current = false
      setIsLoading(false)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void save()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isLoading) setOpen(next)
      }}
    >
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

        {pendingBatch && (
          <p role="status" className="text-sm">
            Operación original pendiente. Vehículo: {pendingBatch.vehicleId}. Referencia: {pendingBatch.operationId}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={isLoading || !!pendingBatch} className="contents">
            {/* Información general */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="service_date" className="text-sm font-medium">
                  Fecha de Servicio *
                </Label>
                <Input
                  id="service_date"
                  type="date"
                  value={displayedForm.service_date}
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
                  value={displayedForm.mileage}
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

              {displayedServices.map((service, index) => (
                <div
                  key={service.id}
                  className="border-border bg-background relative space-y-2.5 rounded-md border p-3"
                >
                  {displayedServices.length > 1 && (
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
                    <Label htmlFor={`service-type-${service.id}`} className="text-xs font-medium">
                      Tipo {displayedServices.length > 1 ? `#${index + 1}` : ""} *
                    </Label>
                    <Select value={service.type} onValueChange={(value) => updateService(service.id, "type", value)}>
                      <SelectTrigger id={`service-type-${service.id}`} className="h-9 text-sm">
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
                value={displayedForm.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="resize-none text-sm"
              />
              <p className="text-muted-foreground text-xs leading-5">
                Incluye solo información necesaria del vehículo. No introduzcas datos sensibles ni datos personales de
                terceras personas.
              </p>
            </div>

            {pendingSchedules.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="completion-schedule">Resolver una previsión (opcional)</Label>
                <Select value={displayedSchedule} onValueChange={setSelectedSchedule}>
                  <SelectTrigger id="completion-schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin resolver previsión</SelectItem>
                    {pendingSchedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {maintenanceTypes.find((type) => type.value === schedule.type)?.label ?? schedule.type}
                        {schedule.scheduled_date ? ` · ${schedule.scheduled_date}` : ""}
                        {schedule.scheduled_mileage !== null && schedule.scheduled_mileage !== undefined
                          ? ` · ${schedule.scheduled_mileage} km`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {displayedSchedule !== "none" && (
                  <>
                    <Label htmlFor="completion-row">Vincular al servicio</Label>
                    <Select value={displayedCompletionRow} onValueChange={setCompletionRowId}>
                      <SelectTrigger id="completion-row">
                        <SelectValue placeholder="Seleccionar servicio" />
                      </SelectTrigger>
                      <SelectContent>
                        {displayedServices.map((row, index) =>
                          row.type ? (
                            <SelectItem key={row.id} value={row.id}>
                              Servicio #{index + 1}: {maintenanceTypes.find((type) => type.value === row.type)?.label}
                            </SelectItem>
                          ) : null
                        )}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            )}
          </fieldset>
          {operationStorageError && (
            <p role="alert">
              No se pudo guardar la referencia o recuperar las referencias pendientes en esta pestaña. No se ha enviado
              un lote nuevo. Revisa el almacenamiento antes de continuar.
            </p>
          )}
          {error && (
            <div
              role="alert"
              className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-2.5 text-xs sm:text-sm"
            >
              {error}
            </div>
          )}

          {pendingOperation && !isLoading && (
            <Button type="button" variant="outline" onClick={() => void save(true)}>
              Comprobar resultado
            </Button>
          )}
          {/* Botones optimizados para touch */}
          <div className="border-border flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:gap-3">
            <Button
              type="button"
              disabled={isLoading}
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 flex-1 sm:h-11"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 h-10 flex-1 font-medium sm:h-11"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : pendingOperation ? (
                "Reintentar misma operación"
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
