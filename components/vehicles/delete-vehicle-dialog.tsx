"use client"

import { OperationRecovery } from "@/components/data/operation-recovery"
import { useData } from "@/contexts"
import { useEditor } from "@/hooks/use-editor"
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
  const { deleteVehicle } = useData()

  const editor = useEditor({ kind: "crud", open, onOpenChange, failureMessage: "Error al eliminar vehículo" })
  const handleDelete = () => void editor.submit(() => ({ send: () => deleteVehicle(vehicle.id) }))

  return (
    <Dialog open={editor.open} onOpenChange={editor.setOpen}>
      <DialogContent className="sm:max-w-[400px]" data-editor-state={editor.state.status}>
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
        {editor.error && (
          <div
            role="alert"
            className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-3 text-sm"
          >
            {editor.error}
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => editor.setOpen(false)} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            disabled={editor.submitting || editor.frozen}
            variant="destructive"
            className="flex-1"
          >
            {editor.submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar Vehículo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
