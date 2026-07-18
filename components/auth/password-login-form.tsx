"use client"

import { useActionState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAnalytics } from "@/hooks/use-analytics"
import { GoogleSignInButton } from "./google-signin-button"
import { PasswordLoginFeedback } from "./password-login-feedback"
import { runPasswordLoginFormAction } from "./password-login-form-action"
import { loginAction } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AUTH_COMMAND_STATUS } from "@/lib/auth/contracts"
import type { PasswordLoginResult } from "@/lib/auth/password-login"

interface PasswordLoginFormProps {
  redirectTo: string
}

export function PasswordLoginForm({ redirectTo }: PasswordLoginFormProps) {
  const router = useRouter()
  const { trackAuthAction } = useAnalytics()
  const [result, formAction, isPending] = useActionState(
    (previousResult: PasswordLoginResult | null, formData: FormData) =>
      runPasswordLoginFormAction(previousResult, formData, {
        loginAction,
        onAttempt() {
          trackAuthAction("sign_in", "email")
        },
        onError() {
          trackAuthAction("error", "email")
        },
        onSuccess(destination) {
          trackAuthAction("sign_in", "email")
          router.replace(destination)
          router.refresh()
        },
      }),
    null
  )
  const error = result?.status === AUTH_COMMAND_STATUS.ERROR ? result.error : null

  return (
    <form action={formAction} aria-busy={isPending}>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="flex flex-col gap-4">
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
            autoComplete="current-password"
            required
            disabled={isPending}
            className="bg-input border-border"
          />
        </div>

        <PasswordLoginFeedback error={error} />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Iniciando sesión..." : "Iniciar Sesión"}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="border-border w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background text-muted-foreground px-2">O continúa con</span>
          </div>
        </div>

        <GoogleSignInButton redirectTo={redirectTo} className="w-full" />
      </div>
      <div className="text-muted-foreground mt-4 text-center text-sm">
        ¿No tienes una cuenta?{" "}
        <Link href="/auth/signup" className="text-primary hover:text-primary/80 underline underline-offset-4">
          Regístrate
        </Link>
      </div>
    </form>
  )
}
