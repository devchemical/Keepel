"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useData } from "@/contexts"
import type { OperationOutcome } from "@/lib/data/operation-machine"
import {
  EDITOR_FAILURE_MESSAGES,
  OPERATION_SUCCESS_MESSAGES,
  operationMessage,
  type EditorAction,
} from "@/lib/data/operation-messages"
import {
  EDITOR_CLOSED,
  EDITOR_EDITING,
  EDITOR_POLICY,
  confirmsDraft,
  editorFrozen,
  isEditorOpen,
  settledOperation,
  transitionEditor,
  type EditorEvent,
  type EditorKind,
  type EditorState,
} from "@/lib/ui/editor-machine"

/** What a submit attempt prepared: a validation message, or the write to send. */
export type EditorAttempt = { validationError: string } | { send: () => Promise<OperationOutcome> }

export type EditorSubmitResult = {
  status: OperationOutcome["status"] | "invalid" | "failed"
  /** The copy shown in the editor, or `null` when the write was confirmed. */
  message: string | null
}

type UseEditorOptions = {
  kind: EditorKind
  /** The command the editor writes; selects its success toast and failure copy. */
  action: EditorAction
  /** Controlled visibility. When omitted, the editor owns it. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Reset a create editor's draft after its write is confirmed. */
  onConfirmed?: () => void
}

/** React binding for the editor dialog machine (lib/ui/editor-machine.ts). */
export function useEditor({ kind, action, open, onOpenChange, onConfirmed }: UseEditorOptions) {
  const policy = EDITOR_POLICY[kind]
  const { pendingOperations, rejectedOperations } = useData()
  const [state, setState] = useState<EditorState>(() => (open ? EDITOR_EDITING : EDITOR_CLOSED))
  const current = useRef(state)
  const callbacks = useRef({ onOpenChange, onConfirmed })
  useEffect(() => {
    callbacks.current = { onOpenChange, onConfirmed }
  })

  const dispatch = useCallback((event: EditorEvent, notifyParent = true) => {
    const previous = current.current
    const next = transitionEditor(previous, event)
    if (confirmsDraft(previous, event)) callbacks.current.onConfirmed?.()
    current.current = next
    setState(next)
    const visible = isEditorOpen(next)
    if (notifyParent && visible !== isEditorOpen(previous)) callbacks.current.onOpenChange?.(visible)
  }, [])

  // A controlled parent opens the editor without going through `setOpen`.
  useEffect(() => {
    if (open === undefined || open === isEditorOpen(current.current)) return
    dispatch({ type: open ? "OPEN" : "CLOSE" }, false)
  }, [open, dispatch])

  // Only the editor's own operation leaving the pending list confirmed closes it and resets its
  // draft (D1); a rejected replay returns it to editing with the rejection inline (D2).
  useEffect(() => {
    if (!policy.closeWhenOwnSettled) return
    const settled = settledOperation(state, pendingOperations, rejectedOperations)
    if (settled === null) return
    dispatch(
      settled.outcome === "confirmed"
        ? { type: "OPERATION_SETTLED", operationId: settled.operationId, outcome: "confirmed", message: null }
        : {
            type: "OPERATION_SETTLED",
            operationId: settled.operationId,
            outcome: "rejected",
            message: operationMessage(kind, { status: "rejected" }),
          }
    )
  }, [state, pendingOperations, rejectedOperations, policy.closeWhenOwnSettled, kind, dispatch])

  const setOpen = useCallback((next: boolean) => dispatch({ type: next ? "OPEN" : "CLOSE" }), [dispatch])

  const submit = async (attempt: () => EditorAttempt): Promise<EditorSubmitResult | null> => {
    const { status } = current.current
    if (status !== "editing" && status !== "unresolved") return null
    const prepared = attempt()
    if ("validationError" in prepared) {
      dispatch({ type: "SUBMIT", validationError: prepared.validationError })
      return { status: "invalid", message: prepared.validationError }
    }
    dispatch({ type: "SUBMIT", validationError: null })
    let outcome: OperationOutcome
    try {
      outcome = await prepared.send()
    } catch (error: unknown) {
      const message = kind === "crud" && error instanceof Error ? error.message : EDITOR_FAILURE_MESSAGES[action]
      dispatch({ type: "FAILED", message })
      return { status: "failed", message }
    }
    const message = operationMessage(kind, outcome)
    dispatch({ type: "OUTCOME", outcome, message })
    // Confirmed writes get one toast; every other outcome stays inline in the editor.
    if (outcome.status === "confirmed") toast.success(OPERATION_SUCCESS_MESSAGES[action])
    return { status: outcome.status, message }
  }

  return {
    state,
    /** Dialog visibility: the controlled prop when given, otherwise the machine's. */
    open: open ?? isEditorOpen(state),
    setOpen,
    submit,
    submitting: state.status === "submitting",
    /** Pending operations freeze the fields per `EDITOR_POLICY`. */
    frozen: editorFrozen(kind, state, pendingOperations),
    error: state.status === "submitting" ? null : state.error,
  }
}
