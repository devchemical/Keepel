"use client"

/* eslint-disable eslint/no-shadow -- The caught error is rendered by the form error state. */

import { useState } from "react"
import { OperationRecovery, usePendingDataOperation } from "@/components/data/operation-recovery"
import { useData } from "@/contexts"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, Loader2 } from "lucide-react"

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
}

interface DeleteVehicleDialogProps {
  vehicle: Vehicle
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteVehicleDialog({ vehicle, open, onOpenChange }: DeleteVehicleDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { deleteVehicleOptimistic } = useData()

  const pending = usePendingDataOperation(() => {
    setError(null)
    onOpenChange(false)
  })
  const handleDelete = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await deleteVehicleOptimistic(vehicle.id)

      onOpenChange(false)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error al eliminar vehículo")
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
            Eliminar Vehículo
          </DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que deseas eliminar el vehículo{" "}
            <span className="font-semibold">
              {vehicle.make} {vehicle.model} {vehicle.year}
            </span>
            ?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-destructive/10 border-destructive/20 mb-4 rounded-md border p-3">
          <p className="text-destructive-foreground text-sm">
            <strong>Advertencia:</strong> Esta acción eliminará permanentemente el vehículo y todos sus registros de
            mantenimiento asociados. Esta acción no se puede deshacer.
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
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar Vehículo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
