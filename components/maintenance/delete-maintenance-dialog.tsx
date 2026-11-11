"use client"

import { MAINTENANCE_TYPES } from "@/lib/data/maintenance-types"

/* eslint-disable eslint/no-shadow -- The caught error is rendered by the form error state. */

import { formatDate } from "@/lib/formatters"
import { useState } from "react"
import { OperationRecovery, usePendingDataOperation } from "@/components/data/operation-recovery"
import { useData } from "@/contexts"
import { operationMessage } from "@/lib/data/operation-messages"
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { deleteMaintenance } = useData()

  const pending = usePendingDataOperation(() => {
    setError(null)
    onOpenChange(false)
  })
  const handleDelete = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const message = operationMessage("crud", await deleteMaintenance(record.id))
      if (message) {
        setError(message)
        return
      }

      onOpenChange(false)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido al eliminar registro"
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
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

        <OperationRecovery />
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
          <Button onClick={handleDelete} disabled={isLoading || pending} variant="destructive" className="flex-1">
            {isLoading ? (
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
