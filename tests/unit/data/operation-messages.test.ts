import { describe, expect, it } from "vitest"
import { BLOCK_REASON } from "@/lib/data/operation-machine"
import {
  EDITOR_FAILURE_MESSAGES,
  OPERATION_SUCCESS_MESSAGES,
  operationMessage,
  RECOVERY_STATUS_MESSAGES,
  replayRejectionToast,
} from "@/lib/data/operation-messages"

// Characterization: the copy CRUD dialogs rendered from thrown errors and the batch editor
// rendered from its result before outcomes became values.
const OPERATION_ID = "33333333-3333-4333-8333-333333333333"

describe("CRUD outcome copy", () => {
  it.each([
    [{ status: "blocked", reason: "no-session" } as const, "No hay sesión activa"],
    [
      { status: "blocked", reason: "journal-unreadable" } as const,
      "No se pudieron recuperar las referencias pendientes. Recarga cuando el almacenamiento esté disponible.",
    ],
    [
      { status: "blocked", reason: "conflict" } as const,
      "Resultado pendiente de confirmar. Comprueba la operación anterior antes de continuar.",
    ],
    [
      { status: "blocked", reason: "session-changed" } as const,
      "La sesión ha cambiado. No se aplicó una respuesta anterior.",
    ],
    [
      { status: "unknown", operationId: OPERATION_ID } as const,
      "Resultado pendiente de confirmar. Comprueba el resultado o reintenta la misma operación; no se repetirá el cambio.",
    ],
    [
      { status: "rejected" } as const,
      "No se realizó la operación. No se confirmó ninguna fila; revisa los datos y vuelve a intentarlo.",
    ],
  ])("%o", (outcome, message) => {
    expect(operationMessage("crud", outcome)).toBe(message)
  })
})

describe("batch outcome copy", () => {
  const rejected = "No se pudo guardar el mantenimiento. Revisa los datos y la sesión e inténtalo de nuevo."
  const unknown =
    "Resultado pendiente de confirmar. Comprueba el resultado o reintenta la misma operación; no se duplicarán los servicios."

  it("reports rejection, missing session and an unusable journal as not saved", () => {
    expect(operationMessage("batch", { status: "rejected" })).toBe(rejected)
    for (const reason of ["no-session", "journal-unreadable", "journal-unwritable"] as const)
      expect(operationMessage("batch", { status: "blocked", reason })).toBe(rejected)
  })

  it("reports no proof, a conflicting batch and a changed session as pending confirmation", () => {
    expect(operationMessage("batch", { status: "unknown", operationId: OPERATION_ID })).toBe(unknown)
    for (const reason of ["conflict", "session-changed"] as const)
      expect(operationMessage("batch", { status: "blocked", reason })).toBe(unknown)
  })
})

describe("every outcome has copy", () => {
  it("returns null only for a confirmed outcome", () => {
    for (const kind of ["crud", "batch"] as const) {
      expect(operationMessage(kind, { status: "confirmed" })).toBeNull()
      for (const reason of BLOCK_REASON) expect(operationMessage(kind, { status: "blocked", reason })).toBeTruthy()
    }
  })

  it("shows a sending operation as being checked on its recovery card", () => {
    expect(RECOVERY_STATUS_MESSAGES).toEqual({
      sending: "Comprobando operación…",
      checking: "Comprobando operación…",
      unknown: "Resultado pendiente de confirmar. No repitas la operación.",
    })
  })
})

describe("confirmed write copy (D3)", () => {
  it("gives every editor command one success toast", () => {
    expect(OPERATION_SUCCESS_MESSAGES).toEqual({
      "maintenance.batch": "Mantenimiento registrado correctamente",
      "vehicle.create": "Vehículo agregado correctamente",
      "vehicle.update": "Vehículo actualizado correctamente",
      "vehicle.delete": "Vehículo eliminado correctamente",
      "maintenance.update": "Mantenimiento actualizado correctamente",
      "maintenance.delete": "Mantenimiento eliminado correctamente",
      "schedule.create": "Servicio programado correctamente",
      "schedule.update": "Servicio actualizado correctamente",
      "schedule.cancel": "Previsión cancelada",
    })
  })
})

describe("editor failure copy", () => {
  // Characterization: the copy each dialog passed inline for a write that threw.
  it("keeps every editor's copy verbatim", () => {
    expect(EDITOR_FAILURE_MESSAGES).toEqual({
      "maintenance.batch": "Resultado pendiente de confirmar. Comprueba el resultado antes de crear otra operación.",
      "vehicle.create": "Error al agregar vehículo",
      "vehicle.update": "Error al actualizar vehículo",
      "vehicle.delete": "Error al eliminar vehículo",
      "maintenance.update": "Error desconocido al actualizar mantenimiento",
      "maintenance.delete": "Error desconocido al eliminar registro",
      "schedule.create": "Error desconocido al programar servicio",
      "schedule.update": "Error desconocido al actualizar servicio",
    })
  })
})

describe("replay rejection toast", () => {
  const CRUD_REJECTED =
    "No se realizó la operación. No se confirmó ninguna fila; revisa los datos y vuelve a intentarlo."
  const OTHER_ID = "44444444-4444-4444-8444-444444444444"
  const crud = { operationId: OPERATION_ID, action: "schedule.create" } as const
  const rejected = { status: "rejected" } as const

  it("toasts a rejected CRUD replay from the standalone recovery panel", () => {
    expect(replayRejectionToast(crud, rejected, null)).toBe(CRUD_REJECTED)
  })

  it("stays silent when the embedding editor owns the operation and shows the rejection inline", () => {
    expect(replayRejectionToast(crud, rejected, OPERATION_ID)).toBeNull()
  })

  it("toasts a rejected replay of an operation another editor owns", () => {
    expect(replayRejectionToast(crud, rejected, OTHER_ID)).toBe(CRUD_REJECTED)
  })

  it("never toasts a confirmed or unknown replay, or a batch replay", () => {
    expect(replayRejectionToast(crud, { status: "confirmed" }, null)).toBeNull()
    expect(replayRejectionToast(crud, { status: "unknown", operationId: OPERATION_ID }, null)).toBeNull()
    expect(replayRejectionToast({ operationId: OPERATION_ID, action: "maintenance.batch" }, rejected, null)).toBeNull()
  })
})
