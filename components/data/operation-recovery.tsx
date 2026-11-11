"use client"
import { useData } from "@/contexts"
import { Button } from "@/components/ui/button"
import { OPERATION_POLICY, operationKind } from "@/lib/data/operation-machine"
import { JOURNAL_RECOVERY_ALERT, OPERATION_LABELS, RECOVERY_STATUS_MESSAGES } from "@/lib/data/operation-messages"

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
      {operationStorageError && <p role="alert">{JOURNAL_RECOVERY_ALERT}</p>}
      {pendingOperations.map(({ command, status }) => (
        <div
          key={command.operationId}
          className="my-2 space-y-2 rounded-md border p-3"
          data-operation-status={status}
          data-operation-id={command.operationId}
        >
          <p role="status">
            {OPERATION_LABELS[command.action]}: {RECOVERY_STATUS_MESSAGES[status]}
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
          {command.action === "maintenance.batch" &&
            OPERATION_POLICY[operationKind(command.action)].replayable &&
            status !== "sending" && (
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
