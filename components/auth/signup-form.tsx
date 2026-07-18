"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { signupAction } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SIGN_UP_STATUS, type SignUpResult } from "@/lib/auth/contracts"
import { SignupFeedback } from "./signup-feedback"
import { runSignupFormAction } from "./signup-form-action"

export function SignupForm() {
  const router = useRouter()
  const [result, formAction, isPending] = useActionState(
    (previousResult: SignUpResult | null, formData: FormData) =>
      runSignupFormAction(previousResult, formData, {
        signupAction,
        onAuthenticated(destination) {
          router.replace(destination)
          router.refresh()
        },
        onConfirmationRequired(destination) {
          router.replace(destination)
        },
      }),
    null
  )
  const error = result?.status === SIGN_UP_STATUS.ERROR ? result.error : null

  return (
    <form action={formAction} aria-busy={isPending}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="fullName" className="text-foreground">
            Nombre Completo
          </Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Tu nombre completo"
            required
            disabled={isPending}
            className="bg-input border-border"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-foreground">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            required
            disabled={isPending}
            className="bg-input border-border"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password" className="text-foreground">
            Contraseña
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            minLength={6}
            required
            disabled={isPending}
            className="bg-input border-border"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword" className="text-foreground">
            Confirmar Contraseña
          </Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repite tu contraseña"
            minLength={6}
            required
            disabled={isPending}
            className="bg-input border-border"
          />
        </div>

        <SignupFeedback error={error} />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Creando cuenta..." : "Crear Cuenta"}
        </Button>
      </div>
    </form>
  )
}
