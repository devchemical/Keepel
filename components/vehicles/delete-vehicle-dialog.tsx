"use client"

/* eslint-disable no-console, eslint/no-shadow -- Refresh failures are diagnostic only and dialog error state uses conventional naming. */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAnalytics } from "@/hooks/use-analytics"
import { useSupabase, useData } from "@/contexts"
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

  const supabase = useSupabase()
  const { refreshVehicles } = useData()
  const router = useRouter()
  const { trackVehicleAction } = useAnalytics()

  const handleDelete = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Track vehicle delete attempt
      trackVehicleAction("delete", vehicle.id)

      const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id)

      if (error) throw error

      // Track successful delete
      trackVehicleAction("delete", vehicle.id)

      onOpenChange(false)
    } catch (error: unknown) {
      // Track error
      trackVehicleAction("delete", vehicle.id)
      setError(error instanceof Error ? error.message : "Error al eliminar vehículo")
    } finally {
      setIsLoading(false)
      refreshVehicles().catch((err) => console.error("Error al refrescar:", err))
      router.refresh()
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

        {error && (
          <div className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleDelete} disabled={isLoading} variant="destructive" className="flex-1">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar Vehículo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
