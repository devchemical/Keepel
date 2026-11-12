"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { OperationRecovery } from "@/components/data/operation-recovery"
import { useData } from "@/contexts"
import { useEditor } from "@/hooks/use-editor"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Loader2 } from "lucide-react"

import { MAINTENANCE_TYPES as maintenanceTypes } from "@/lib/data/maintenance-types"
import { scheduledServiceSchema } from "@/lib/data/scheduled-command"

interface EditableScheduledService {
  id: string
  type: string
  description?: string | null
  scheduled_date?: string | null
  scheduled_mileage?: number | null
  notes?: string | null
}

interface EditScheduledServiceDialogProps {
  service: EditableScheduledService
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditScheduledServiceDialog({ service, open, onOpenChange }: EditScheduledServiceDialogProps) {
  const { updateScheduledService } = useData()

  const [formData, setFormData] = useState({
    type: service.type,
    description: service.description || "",
    scheduled_date: service.scheduled_date || "",
    scheduled_mileage: service.scheduled_mileage?.toString() || "",
    notes: service.notes || "",
  })

  useEffect(() => {
    setFormData({
      type: service.type,
      description: service.description || "",
      scheduled_date: service.scheduled_date || "",
      scheduled_mileage: service.scheduled_mileage?.toString() || "",
      notes: service.notes || "",
    })
  }, [service])

  const editor = useEditor({
    kind: "crud",
    action: "schedule.update",
    open,
    onOpenChange,
  })
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void editor.submit(() => {
      if (!service?.id) return { validationError: "ID del servicio no válido" }
      const parsed = scheduledServiceSchema.safeParse(formData)
      if (!parsed.success)
        return {
          validationError: "Indica un tipo válido y al menos una fecha o un kilometraje válido mayor o igual a 0.",
        }
      return { send: () => updateScheduledService(service.id, parsed.data) }
    })
  }

  return (
    <Dialog open={editor.open} onOpenChange={editor.setOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Calendar className="text-primary h-5 w-5" />
            <span>Editar Servicio Programado</span>
          </DialogTitle>
          <DialogDescription className="text-sm">Modifica los detalles del mantenimiento programado.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" data-editor-state={editor.state.status}>
          <OperationRecovery ownedOperationId={editor.ownedOperationId} />
          <fieldset disabled={editor.frozen || editor.submitting} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-sm font-medium">
                Tipo de Servicio *
              </Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger disabled={editor.frozen || editor.submitting} id="type" className="h-10">
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
            </div>

            {editor.error && (
              <div
                role="alert"
                className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-2.5 text-xs sm:text-sm"
              >
                {editor.error}
              </div>
            )}

            <div className="border-border flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={editor.submitting}
                onClick={() => editor.setOpen(false)}
                className="h-10 flex-1 sm:h-11"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={editor.submitting || !formData.type}
                className="bg-primary hover:bg-primary/90 h-10 flex-1 font-medium sm:h-11"
              >
                {editor.submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Guardar Cambios"
                )}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
