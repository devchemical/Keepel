// The only place that maps data operation outcomes and states to Spanish copy.
// Strings are user-visible contracts asserted by e2e tests; change them deliberately.

import type { PendingCommand } from "./pending-operations"
import { operationKind } from "./operation-machine"
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

/** The one `sonner` success toast an editor shows when its write is confirmed. */
export const OPERATION_SUCCESS_MESSAGES: Record<PendingCommand["action"], string> = {
  "maintenance.batch": "Mantenimiento registrado correctamente",
  "vehicle.create": "Vehículo agregado correctamente",
  "vehicle.update": "Vehículo actualizado correctamente",
  "vehicle.delete": "Vehículo eliminado correctamente",
  "maintenance.update": "Mantenimiento actualizado correctamente",
  "maintenance.delete": "Mantenimiento eliminado correctamente",
  "schedule.create": "Servicio programado correctamente",
  "schedule.update": "Servicio actualizado correctamente",
  "schedule.cancel": "Previsión cancelada",
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

/** Commands written through an editor dialog; cancelling a scheduled service is a list action. */
export type EditorAction = Exclude<PendingCommand["action"], "schedule.cancel">

/**
 * An editor's copy when its write throws instead of returning an outcome. CRUD editors show a
 * thrown `Error`'s own message and fall back to this copy.
 */
export const EDITOR_FAILURE_MESSAGES: Record<EditorAction, string> = {
  "maintenance.batch": "Resultado pendiente de confirmar. Comprueba el resultado antes de crear otra operación.",
  "vehicle.create": "Error al agregar vehículo",
  "vehicle.update": "Error al actualizar vehículo",
  "vehicle.delete": "Error al eliminar vehículo",
  "maintenance.update": "Error desconocido al actualizar mantenimiento",
  "maintenance.delete": "Error desconocido al eliminar registro",
  "schedule.create": "Error desconocido al programar servicio",
  "schedule.update": "Error desconocido al actualizar servicio",
}

const CRUD_REJECTED = "No se realizó la operación. No se confirmó ninguna fila; revisa los datos y vuelve a intentarlo."
const BATCH_REJECTED = "No se pudo guardar el mantenimiento. Revisa los datos y la sesión e inténtalo de nuevo."
const BATCH_UNKNOWN =
  "Resultado pendiente de confirmar. Comprueba el resultado o reintenta la misma operación; no se duplicarán los servicios."
// A replay or check names an operation that has already left the pending list, or one that is
// still being sent or checked.
const NOT_PENDING = "La operación ya no está pendiente."
const NOT_REPLAYABLE = "La operación todavía se está comprobando. Espera a que termine antes de reintentarla."

type FailedOutcome = Exclude<OperationOutcome["status"], "confirmed" | "blocked">

const MESSAGES: Record<OperationKind, Record<FailedOutcome | BlockReason, string>> = {
  crud: {
    rejected: CRUD_REJECTED,
    unknown:
      "Resultado pendiente de confirmar. Comprueba el resultado o reintenta la misma operación; no se repetirá el cambio.",
    conflict: "Resultado pendiente de confirmar. Comprueba la operación anterior antes de continuar.",
    "journal-unreadable":
      "No se pudieron recuperar las referencias pendientes. Recarga cuando el almacenamiento esté disponible.",
    // CRUD policy does not require a durable journal, so the owner never reports this for CRUD.
    "journal-unwritable": CRUD_REJECTED,
    "no-session": "No hay sesión activa",
    "not-pending": NOT_PENDING,
    "not-replayable": NOT_REPLAYABLE,
    "session-changed": "La sesión ha cambiado. No se aplicó una respuesta anterior.",
  },
  batch: {
    rejected: BATCH_REJECTED,
    unknown: BATCH_UNKNOWN,
    conflict: BATCH_UNKNOWN,
    "journal-unreadable": BATCH_REJECTED,
    "journal-unwritable": BATCH_REJECTED,
    "no-session": BATCH_REJECTED,
    "not-pending": NOT_PENDING,
    "not-replayable": NOT_REPLAYABLE,
    "session-changed": BATCH_UNKNOWN,
  },
}

/** Copy for an outcome, or `null` when it was confirmed and needs no message. */
export function operationMessage(
  kind: OperationKind,
  outcome: Exclude<OperationOutcome, { status: "confirmed" }>
): string
export function operationMessage(kind: OperationKind, outcome: OperationOutcome): string | null
export function operationMessage(kind: OperationKind, outcome: OperationOutcome): string | null {
  if (outcome.status === "confirmed") return null
  return MESSAGES[kind][outcome.status === "blocked" ? outcome.reason : outcome.status]
}

/**
 * The toast for a rejected CRUD replay, or `null`. A rejected replay leaves the pending list, so its
 * recovery card disappears and the panel says why — unless the editor embedding that card owns the
 * operation (`ownedOperationId`), which already shows the rejection inline (D2).
 */
export function replayRejectionToast(
  command: Pick<PendingCommand, "operationId" | "action">,
  outcome: OperationOutcome,
  ownedOperationId: string | null
): string | null {
  if (outcome.status !== "rejected" || operationKind(command.action) !== "crud") return null
  return command.operationId === ownedOperationId ? null : operationMessage("crud", outcome)
}
