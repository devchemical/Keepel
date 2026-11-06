"use client"
import { useEffect, useRef } from "react"
import { useData } from "@/contexts"
import { Button } from "@/components/ui/button"

const labels = {
  "maintenance.batch": "Alta múltiple de mantenimiento",
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
  const {
    pendingOperations,
    reconcileDataOperation,
    reconcileMaintenanceBatch,
    createMaintenanceBatch,
    operationStorageError,
  } = useData()
  return (
    <>
      {operationStorageError && (
        <p role="alert">
          No se pudieron conservar o recuperar las referencias en esta pestaña. Recarga cuando el almacenamiento esté
          disponible. No se enviará un lote nuevo sin guardarla. Mantén esta página abierta si hay una operación
          pendiente.
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
          {command.action === "maintenance.batch" && (
            <p className="text-sm">
              Fecha: {command.batch.service_date} · {command.batch.services.length} servicio(s)
            </p>
          )}
          {command.action === "maintenance.batch" && (
            <details>
              <summary>Datos de la operación original</summary>
              <p>
                Vehículo: {command.vehicleId} · Día de referencia: {command.today}
              </p>
              <p>
                Kilometraje: {command.batch.mileage ?? "Sin informar"} · Notas: {command.batch.notes ?? "Sin informar"}
              </p>
              <p>
                {command.batch.services
                  .map(
                    (row, index) =>
                      `${index + 1}. ${row.type} · ${row.description ?? "Sin descripción"} · ${row.cost ?? "Sin costo"}`
                  )
                  .join("; ")}
              </p>
              {command.completion && (
                <p>
                  Previsión: {command.completion.scheduled_service_id} · Servicio #
                  {command.completion.service_index + 1}
                </p>
              )}
            </details>
          )}
          {status !== "sending" && (
            <Button
              type="button"
              variant="outline"
              disabled={status === "checking"}
              onClick={() =>
                void (command.action === "maintenance.batch"
                  ? reconcileMaintenanceBatch(command)
                  : reconcileDataOperation(command.operationId))
              }
            >
              Comprobar resultado
            </Button>
          )}
          {command.action === "maintenance.batch" && status !== "sending" && (
            <Button
              type="button"
              variant="outline"
              disabled={status === "checking"}
              onClick={() => void createMaintenanceBatch(command)}
            >
              Reintentar misma operación
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
