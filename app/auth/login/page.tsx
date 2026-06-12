"use client"

/* eslint-disable no-console, eslint/no-shadow -- Auth cleanup errors are intentionally logged and local error state is named for UI clarity. */

import type React from "react"

import { useAnalytics } from "@/hooks/use-analytics"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleSignInButton } from "@/components/auth/google-signin-button"
import { Layout } from "../../../components/layout/Layout"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useSupabase } from "@/hooks/useSupabase"
import { loginAction } from "../actions"
import { authManager } from "@/lib/auth/authManager"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining: number
    limit: number
    reset: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = useSupabase()
  const { trackAuthAction } = useAnalytics()

  // Ensure we're fully logged out when landing on login page
  useEffect(() => {
    const clearSession = async () => {
      try {
        // Check if we're coming from a logout action
        const urlParams = new URLSearchParams(window.location.search)
        const isLogout = urlParams.has("logout")

        if (isLogout) {
          // Force sign out again to be absolutely sure
          await supabase.auth.signOut()

          // Clear local storage
          if (typeof window !== "undefined") {
            Object.keys(localStorage).forEach((key) => {
              if (key.includes("supabase") || key.includes("sb-")) {
                localStorage.removeItem(key)
              }
            })

            // Clear session storage
            Object.keys(sessionStorage).forEach((key) => {
              if (key.includes("supabase") || key.includes("sb-")) {
                sessionStorage.removeItem(key)
              }
            })
          }

          // Clean up the URL
          window.history.replaceState({}, document.title, "/auth/login")
        } else {
          // Regular check
          const {
            data: { session },
          } = await supabase.auth.getSession()

          if (session) {
            await supabase.auth.signOut()
          }
        }
      } catch (error) {
        console.error("Error clearing session on login page:", error)
      }
    }

    clearSession()
  }, [supabase])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setRateLimitInfo(null)

    try {
      // Track login attempt
      trackAuthAction("sign_in", "email")

      // Llamar al Server Action
      const result = await loginAction(email, password)

      if (!result.success) {
        // Track login error
        trackAuthAction("error", "email")

        // Si hay información de rate limit, actualizarla
        if (result.rateLimit) {
          setRateLimitInfo(result.rateLimit)

          if (result.rateLimit.remaining > 0) {
            setError(`${result.error}. Te quedan ${result.rateLimit.remaining} de ${result.rateLimit.limit} intentos.`)
          } else {
            const minutesLeft = Math.ceil((result.rateLimit.reset - Date.now()) / 1000 / 60)
            setError(`${result.error}. Podrás intentar de nuevo en ${minutesLeft} minuto(s).`)
          }
        } else {
          setError(result.error || "Error al iniciar sesión")
        }
        return
      }

      if (!result.session) {
        throw new Error("No se pudo sincronizar la sesión. Intenta nuevamente.")
      }

      const { error: sessionError } = await authManager.getSupabase().auth.setSession({
        access_token: result.session.accessToken,
        refresh_token: result.session.refreshToken,
      })

      if (sessionError) {
        console.error("Error sincronizando sesión:", sessionError)
        throw new Error("No se pudo sincronizar la sesión. Intenta nuevamente.")
      }

      // Track successful login
      trackAuthAction("sign_in", "email")

      // Obtener URL de redirección si existe
      const urlParams = new URLSearchParams(window.location.search)
      const redirectTo = urlParams.get("redirect") || result.redirectTo || "/"

      // Hacer refresh para actualizar estado del servidor
      router.refresh()

      // Redirigir al dashboard o a la URL original
      router.push(redirectTo)
    } catch (error: unknown) {
      // Track error
      trackAuthAction("error", "email")

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
      <div className="flex min-h-[calc(100dvh-4rem)] items-start justify-center p-6 pt-12 md:pt-20">
        <div className="w-full max-w-md">
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-foreground text-2xl">Iniciar Sesión</CardTitle>
              <CardDescription className="text-muted-foreground">
                Ingresa tus credenciales para acceder a tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-4">
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
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                  {error && (
                    <div className="text-destructive bg-destructive/10 border-destructive/20 rounded-md border p-3 text-sm">
                      <p>{error}</p>
                      {rateLimitInfo && rateLimitInfo.remaining === 0 && (
                        <p className="mt-2 text-xs">
                          Has alcanzado el límite de intentos. Podrás intentar de nuevo en{" "}
                          {Math.ceil((rateLimitInfo.reset - Date.now()) / 1000 / 60)} minutos.
                        </p>
                      )}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground w-full cursor-pointer"
                    disabled={isLoading}
                  >
                    {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="border-border w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background text-muted-foreground px-2">O continúa con</span>
                    </div>
                  </div>

                  <GoogleSignInButton className="w-full cursor-pointer" supabaseClient={supabase} />
                </div>
                <div className="text-muted-foreground mt-4 text-center text-sm">
                  ¿No tienes una cuenta?{" "}
                  <Link href="/auth/signup" className="text-primary hover:text-primary/80 underline underline-offset-4">
                    Regístrate
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
