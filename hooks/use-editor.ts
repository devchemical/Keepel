"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useData } from "@/contexts"
import type { OperationOutcome } from "@/lib/data/operation-machine"
import { OPERATION_SUCCESS_MESSAGES, operationMessage } from "@/lib/data/operation-messages"
import type { PendingCommand } from "@/lib/data/pending-operations"
import {
  EDITOR_CLOSED,
  EDITOR_EDITING,
  EDITOR_POLICY,
  confirmsDraft,
  editorFrozen,
  isEditorOpen,
  transitionEditor,
  transitionSettleLatch,
  type EditorEvent,
  type EditorKind,
  type EditorState,
  type SettleLatch,
} from "@/lib/ui/editor-machine"

/** What a submit attempt prepared: a validation message, or the write to send. */
export type EditorAttempt = { invalid: string } | { send: () => Promise<OperationOutcome> }

export type EditorSubmitResult = {
  status: OperationOutcome["status"] | "invalid" | "failed"
  /** The copy shown in the editor, or `null` when the write was confirmed. */
  message: string | null
}

type UseEditorOptions = {
  kind: EditorKind
  /** The command the editor writes; selects its success toast. */
  action: PendingCommand["action"]
  /** Controlled visibility. When omitted, the editor owns it. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Reset a create editor's draft after its write is confirmed. */
  onConfirmed?: () => void
  /** Copy for a write that threw instead of returning an outcome. */
  failureMessage: string
}

/** React binding for the editor dialog machine (lib/ui/editor-machine.ts). */
export function useEditor({ kind, action, open, onOpenChange, onConfirmed, failureMessage }: UseEditorOptions) {
  const policy = EDITOR_POLICY[kind]
  const { pendingOperations } = useData()
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
    dispatch(open ? { type: "OPEN" } : { type: "CLOSE", whileSubmitting: policy.closeWhileSubmitting }, false)
  }, [open, dispatch, policy.closeWhileSubmitting])

  const latch = useRef<SettleLatch>("idle")
  useEffect(() => {
    if (!policy.closeWhenAllSettled) return
    const previous = latch.current
    latch.current = transitionSettleLatch(previous, {
      type: "PENDING_CHANGED",
      pending: pendingOperations.length,
      anyUnknown: pendingOperations.some((operation) => operation.status === "unknown"),
    })
    if (previous === "armed" && latch.current === "idle") dispatch({ type: "ALL_SETTLED" })
  }, [pendingOperations, policy.closeWhenAllSettled, dispatch])

  const setOpen = useCallback(
    (next: boolean) =>
      dispatch(next ? { type: "OPEN" } : { type: "CLOSE", whileSubmitting: policy.closeWhileSubmitting }),
    [dispatch, policy.closeWhileSubmitting]
  )

  const submit = async (attempt: () => EditorAttempt): Promise<EditorSubmitResult | null> => {
    const { status } = current.current
    if (status !== "editing" && status !== "unresolved") return null
    const prepared = attempt()
    if ("invalid" in prepared) {
      dispatch({ type: "SUBMIT", invalid: prepared.invalid })
      return { status: "invalid", message: prepared.invalid }
    }
    dispatch({ type: "SUBMIT", invalid: null })
    let outcome: OperationOutcome
    try {
      outcome = await prepared.send()
    } catch (error: unknown) {
      const message = kind === "crud" && error instanceof Error ? error.message : failureMessage
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
    frozen: editorFrozen(kind, pendingOperations),
    error: state.status === "submitting" ? null : state.error,
  }
}
