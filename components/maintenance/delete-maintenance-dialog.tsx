"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAnalytics } from "@/hooks/use-analytics"
import { useSupabase, useData } from "@/contexts"
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

const maintenanceTypes = {
  oil_change: "Cambio de Aceite",
  tire_rotation: "Rotación de Llantas",
  brake_service: "Servicio de Frenos",
  transmission: "Transmisión",
  engine_tune: "Afinación del Motor",
  battery: "Batería",
  air_filter: "Filtro de Aire",
  coolant: "Refrigerante",
  spark_plugs: "Bujías",
  belts_hoses: "Correas y Mangueras",
  suspension: "Suspensión",
  exhaust: "Sistema de Escape",
  other: "Otro",
}

export function DeleteMaintenanceDialog({ record, open, onOpenChange }: DeleteMaintenanceDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = useSupabase()
  const { refreshMaintenance } = useData()
  const router = useRouter()
  const { trackMaintenanceAction } = useAnalytics()

  const handleDelete = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Validaciones básicas
      if (!record?.id) {
        throw new Error("ID del registro no válido")
      }

      // Track maintenance delete attempt
      trackMaintenanceAction("delete", record.id)

      // RLS se encarga de verificar permisos automáticamente
      const deletePromise = supabase.from("maintenance_records").delete().eq("id", record.id)

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("La operación tardó demasiado tiempo. Inténtalo de nuevo.")), 10000)
      })

      const { error: deleteError } = (await Promise.race([deletePromise, timeoutPromise])) as any

      if (deleteError) {
        throw new Error(`Error al eliminar: ${deleteError.message}`)
      }

      // Track successful delete
      trackMaintenanceAction("delete", record.id)

      onOpenChange(false)
    } catch (error: unknown) {
      // Track error
      trackMaintenanceAction("delete", record.id)
      const errorMessage = error instanceof Error ? error.message : "Error desconocido al eliminar registro"
      setError(errorMessage)
    } finally {
      setIsLoading(false)

      // Recargar datos tanto del contexto como de la ruta actual
      refreshMaintenance().catch((err) => {
        console.error("Error al refrescar (no crítico):", err)
      })
      router.refresh()
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
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
              {maintenanceTypes[record.type as keyof typeof maintenanceTypes] || record.type}
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
