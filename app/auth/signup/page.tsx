"use client"

/* eslint-disable eslint/no-shadow -- Local form error state is intentionally named `error` for UI clarity. */

import type React from "react"
import { Layout } from "../../../components/layout/Layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleSignInButton } from "@/components/auth/google-signin-button"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useSupabase } from "@/hooks/useSupabase"
import { signupAction } from "../actions"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining: number
    limit: number
    reset: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Crear una sola instancia del cliente de Supabase para toda la página
  const supabase = useSupabase()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setRateLimitInfo(null)

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      setIsLoading(false)
      return
    }

    try {
      // Llamar al Server Action
      const result = await signupAction(email, password, fullName)

      if (!result.success) {
        // Si hay información de rate limit, actualizarla
        if (result.rateLimit) {
          setRateLimitInfo(result.rateLimit)

          if (result.rateLimit.remaining > 0) {
            setError(`${result.error}. Te quedan ${result.rateLimit.remaining} de ${result.rateLimit.limit} intentos.`)
          } else {
            const hoursLeft = Math.ceil((result.rateLimit.reset - Date.now()) / 1000 / 60 / 60)
            setError(`${result.error}. Podrás intentar de nuevo en ${hoursLeft} hora(s).`)
          }
        } else {
          setError(result.error || "Error al crear la cuenta")
        }
        return
      }

      // Redirigir a la página de éxito
      router.push(result.redirectTo || "/auth/signup-success")
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message)
      } else {
        setError("Ocurrió un error desconocido")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout showHeader={true}>
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-foreground text-2xl">Crear Cuenta</CardTitle>
              <CardDescription>
                Crea tu cuenta para comenzar a gestionar el mantenimiento de tus vehículos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <GoogleSignInButton className="cursor-pointer" supabaseClient={supabase}>
                  Crear cuenta con Google
                </GoogleSignInButton>
              </div>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background text-muted-foreground px-2">O continúa con email</span>
                </div>
              </div>

              <form onSubmit={handleSignUp}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fullName" className="text-foreground">
                      Nombre Completo
                    </Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Tu nombre completo"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-foreground">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-foreground">
                      Contraseña
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword" className="text-foreground">
                      Confirmar Contraseña
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Repite tu contraseña"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                  {error && (
                    <div className="text-destructive-foreground bg-destructive/10 border-destructive/20 rounded-md border p-3 text-sm">
                      <p>{error}</p>
                      {rateLimitInfo && rateLimitInfo.remaining === 0 && (
                        <p className="mt-2 text-xs">
                          Has alcanzado el límite de intentos de registro. Podrás intentar de nuevo en{" "}
                          {Math.ceil((rateLimitInfo.reset - Date.now()) / 1000 / 60 / 60)} hora(s).
                        </p>
                      )}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground w-full cursor-pointer"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
                  </Button>
                </div>
                <div className="text-muted-foreground mt-4 text-center text-sm">
                  ¿Ya tienes una cuenta?{" "}
                  <Link href="/auth/login" className="text-primary hover:text-primary/80 underline underline-offset-4">
                    Inicia sesión
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
