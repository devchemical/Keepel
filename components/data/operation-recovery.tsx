"use client"
import { toast } from "sonner"
import { useData } from "@/contexts"
import { Button } from "@/components/ui/button"
import type { PendingCommand } from "@/lib/data/pending-operations"
import {
  JOURNAL_RECOVERY_ALERT,
  OPERATION_LABELS,
  RECOVERY_STATUS_MESSAGES,
  replayRejectionToast,
} from "@/lib/data/operation-messages"

type OperationRecoveryProps = {
  /**
   * The operation owned by the editor embedding this panel. That editor shows its rejection inline,
   * so the panel does not toast it too; the standalone panel omits it.
   */
  ownedOperationId?: string | null
}

export function OperationRecovery({ ownedOperationId = null }: OperationRecoveryProps = {}) {
  const {
    pendingOperations,
    reconcileDataOperation,
    reconcileMaintenanceBatch,
    replayOperation,
    operationStorageError,
  } = useData()
  // An explicit, user-initiated resend of the retained command with the same operation id.
  const replay = async (command: PendingCommand) => {
    const message = replayRejectionToast(command, await replayOperation(command.operationId), ownedOperationId)
    if (message) toast.error(message)
  }
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
          {status !== "sending" && (
            <Button
              type="button"
              variant="outline"
              disabled={status === "checking"}
              onClick={() => void replay(command)}
            >
              Reintentar misma operación
            </Button>
          )}
        </div>
      ))}
    </>
  )
}
