"use client"

import { useActionState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { logoutAction } from "@/app/auth/actions"
import { useAuthProjectionInvalidation } from "@/contexts"
import { useAuthCommandRecovery } from "@/hooks"
import type { LogoutResult } from "@/lib/auth/logout"
import { runLogoutFormAction } from "./logout-form-action"

interface LogoutControlProps {
  children(state: { isPending: boolean }): ReactNode
  className?: string
  onAttempt?: () => void
  onError?: () => void
}

export function LogoutControl({ children, className, onAttempt, onError }: LogoutControlProps) {
  const invalidateProjection = useAuthProjectionInvalidation()
  const recoverSession = useAuthCommandRecovery()
  const router = useRouter()
  const [, formAction, isPending] = useActionState(
    (previousResult: LogoutResult | null, formData: FormData) =>
      runLogoutFormAction(previousResult, formData, {
        logoutAction,
        onAttempt() {
          onAttempt?.()
        },
        onSuccess() {
          invalidateProjection()
          router.replace("/auth/login")
          router.refresh()
        },
        onError(result) {
          onError?.()

          if (!recoverSession(result)) {
            toast.error("No se pudo cerrar la sesión. Inténtalo de nuevo.")
          }
        },
      }),
    null
  )

  return (
    <form action={formAction} aria-busy={isPending} className={className}>
      {children({ isPending })}
    </form>
  )
}
