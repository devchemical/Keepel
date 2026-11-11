// The only place that maps data operation outcomes and states to Spanish copy.
// Strings are user-visible contracts asserted by e2e tests; change them deliberately.

import type { PendingCommand } from "./pending-operations"
import type { BlockReason, OperationKind, OperationOutcome, PendingOperationStatus } from "./operation-machine"

export const OPERATION_LABELS: Record<PendingCommand["action"], string> = {
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

/** Recovery card copy. A `sending` operation is shown as being checked. */
export const RECOVERY_STATUS_MESSAGES: Record<PendingOperationStatus, string> = {
  sending: "Comprobando operación…",
  unknown: "Resultado pendiente de confirmar. No repitas la operación.",
  checking: "Comprobando operación…",
}

/** Shown by the recovery list whenever the journal is not healthy. */
export const JOURNAL_RECOVERY_ALERT =
  "No se pudieron conservar o recuperar las referencias en esta pestaña. Recarga cuando el almacenamiento esté disponible. No se enviará un lote nuevo sin guardarla. Mantén esta página abierta si hay una operación pendiente."

/** Shown by the maintenance batch editor whenever the journal is not healthy. */
export const JOURNAL_BATCH_ALERT =
  "No se pudo guardar la referencia o recuperar las referencias pendientes en esta pestaña. No se ha enviado un lote nuevo. Revisa el almacenamiento antes de continuar."

/** The batch editor's copy when the owner fails unexpectedly instead of returning an outcome. */
export const BATCH_UNEXPECTED_MESSAGE =
  "Resultado pendiente de confirmar. Comprueba el resultado antes de crear otra operación."

const CRUD_REJECTED = "No se realizó la operación. No se confirmó ninguna fila; revisa los datos y vuelve a intentarlo."
const BATCH_REJECTED = "No se pudo guardar el mantenimiento. Revisa los datos y la sesión e inténtalo de nuevo."
const BATCH_UNKNOWN =
  "Resultado pendiente de confirmar. Comprueba el resultado o reintenta la misma operación; no se duplicarán los servicios."

type FailedOutcome = Exclude<OperationOutcome["status"], "confirmed" | "blocked">

const MESSAGES: Record<OperationKind, Record<FailedOutcome | BlockReason, string>> = {
  crud: {
    rejected: CRUD_REJECTED,
    unknown: "Resultado pendiente de confirmar. No repitas la operación; utiliza Comprobar resultado.",
    conflict: "Resultado pendiente de confirmar. Comprueba la operación anterior antes de continuar.",
    "journal-unreadable":
      "No se pudieron recuperar las referencias pendientes. Recarga cuando el almacenamiento esté disponible.",
    // CRUD policy does not require a durable journal, so the owner never reports this for CRUD.
    "journal-unwritable": CRUD_REJECTED,
    "no-session": "No hay sesión activa",
    "session-changed": "La sesión ha cambiado. No se aplicó una respuesta anterior.",
  },
  batch: {
    rejected: BATCH_REJECTED,
    unknown: BATCH_UNKNOWN,
    conflict: BATCH_UNKNOWN,
    "journal-unreadable": BATCH_REJECTED,
    "journal-unwritable": BATCH_REJECTED,
    "no-session": BATCH_REJECTED,
    "session-changed": BATCH_UNKNOWN,
  },
}

/** Copy for an outcome, or `null` when it was confirmed and needs no message. */
export function operationMessage(kind: OperationKind, outcome: OperationOutcome): string | null {
  if (outcome.status === "confirmed") return null
  return MESSAGES[kind][outcome.status === "blocked" ? outcome.reason : outcome.status]
}
