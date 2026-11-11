"use client"

import { useEffect, useState } from "react"
import { MAINTENANCE_TYPES } from "@/lib/data/maintenance-types"
import { completedForecastWarning } from "@/lib/data/operation-messages"

import { formatDate } from "@/lib/formatters"
import { OperationRecovery } from "@/components/data/operation-recovery"
import { useData } from "@/contexts"
import { useEditor } from "@/hooks/use-editor"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, Loader2 } from "lucide-react"

interface MaintenanceRecord {
  id: string
  type: string
  service_date: string
}

interface DeleteMaintenanceDialogProps {
  record: MaintenanceRecord
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteMaintenanceDialog({ record, open, onOpenChange }: DeleteMaintenanceDialogProps) {
  const { deleteMaintenance, findCompletedForecast } = useData()
  // The warning belongs to the record it was read for; a failed or pending read shows none.
  const [warning, setWarning] = useState<{ recordId: string; message: string } | null>(null)

  useEffect(() => {
    if (!open) return
    let current = true
    void findCompletedForecast(record.id).then((forecast) => {
      if (current) setWarning(forecast ? { recordId: record.id, message: completedForecastWarning(forecast) } : null)
    })
    return () => {
      current = false
    }
  }, [open, record.id, findCompletedForecast])
  const forecastWarning = open && warning?.recordId === record.id ? warning.message : null

  const editor = useEditor({
    kind: "crud",
    action: "maintenance.delete",
    open,
    onOpenChange,
  })
  const handleDelete = () => void editor.submit(() => ({ send: () => deleteMaintenance(record.id) }))

  return (
    <Dialog open={editor.open} onOpenChange={editor.setOpen}>
      <DialogContent className="sm:max-w-[400px]" data-editor-state={editor.state.status}>
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Eliminar Registro de Mantenimiento
          </DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas eliminar el registro de{" "}
            <span className="font-semibold">
              {MAINTENANCE_TYPES.find((type) => type.value === record.type)?.label ?? record.type}
            </span>{" "}
            del {formatDate(record.service_date)}?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-destructive/10 border-destructive/20 mb-4 rounded-md border p-3">
          <p className="text-destructive-foreground text-sm">
            <strong>Advertencia:</strong> Esta acción eliminará permanentemente este registro de mantenimiento. Esta
            acción no se puede deshacer.
          </p>
        </div>

        {forecastWarning && (
          <div role="note" className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            {forecastWarning}
          </div>
        )}

        <OperationRecovery />
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
          <Button
            onClick={handleDelete}
            disabled={editor.submitting || editor.frozen}
            variant="destructive"
            className="flex-1"
          >
            {editor.submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Eliminando...
              </>
            ) : (
              "Eliminar Registro"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
