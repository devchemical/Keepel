"use client"
import { useEffect, useRef } from "react"
import { useData } from "@/contexts"
import { Button } from "@/components/ui/button"

const labels = {
  "vehicle.create": "Alta de vehículo",
  "vehicle.update": "Edición de vehículo",
  "vehicle.delete": "Eliminación de vehículo",
  "maintenance.update": "Edición de mantenimiento",
  "maintenance.delete": "Eliminación de mantenimiento",
  "schedule.create": "Programación de servicio",
  "schedule.update": "Edición de previsión",
  "schedule.cancel": "Cancelación de previsión",
}
export function OperationRecovery() {
  const { pendingOperations, reconcileDataOperation, operationStorageError } = useData()
  return (
    <>
      {operationStorageError && pendingOperations.length > 0 && (
        <p role="alert">
          No se pudo conservar la referencia en esta pestaña. Mantén esta página abierta hasta comprobar el resultado.
        </p>
      )}
      {pendingOperations.map(({ command, status }) => (
        <div key={command.operationId} className="my-2 space-y-2 rounded-md border p-3">
          <p role="status">
            {labels[command.action]}:{" "}
            {status === "unknown"
              ? "Resultado pendiente de confirmar. No repitas la operación."
              : "Comprobando operación…"}
          </p>
          <p className="text-muted-foreground text-xs">Referencia: {command.operationId}</p>
          {status !== "sending" && (
            <Button
              type="button"
              variant="outline"
              disabled={status === "checking"}
              onClick={() => void reconcileDataOperation(command.operationId)}
            >
              Comprobar resultado
            </Button>
          )}
        </div>
      ))}
    </>
  )
}

/** Keep the unresolved editor frozen; closing it does not discard the owner's operation. */
export function usePendingDataOperation(onConfirmed: () => void) {
  const { pendingOperations } = useData()
  const unresolved = useRef(false)
  useEffect(() => {
    if (pendingOperations.some((operation) => operation.status === "unknown")) unresolved.current = true
    if (unresolved.current && pendingOperations.length === 0) {
      unresolved.current = false
      onConfirmed()
    }
  }, [pendingOperations, onConfirmed])
  return pendingOperations.length > 0
}
