import { useState } from "react"
import { useAnalytics } from "@/hooks/use-analytics"
import type { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/ui/icons"
import { useSupabase } from "@/hooks/useSupabase"

interface GoogleSignInButtonProps {
  redirectTo?: string
  className?: string
  children?: React.ReactNode
  supabaseClient?: ReturnType<typeof createClient>
}

export function GoogleSignInButton({
  redirectTo = "/",
  className,
  children = "Continuar con Google",
  supabaseClient,
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const defaultSupabase = useSupabase()
  // Usar el cliente pasado como prop o el hook por defecto
  const supabase = supabaseClient || defaultSupabase
  const { trackAuthAction } = useAnalytics()

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)

      // Track Google sign in attempt
      trackAuthAction("sign_in", "google")

      // Usar la URL actual del navegador para garantizar la redirección correcta
      const baseUrl =
        typeof window !== "undefined"
          ? `${window.location.protocol}//${window.location.host}`
          : process.env.NEXT_PUBLIC_APP_URL_PROD!

      const redirectUrl = `${baseUrl}/auth/callback?next=${redirectTo}`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      })

      if (error) {
        console.error("Google OAuth error:", error)
        // Track error
        trackAuthAction("error", "google")
        setIsLoading(false)
      }
      // No quitamos el loading state si no hay error porque seremos redirigidos
    } catch (error) {
      console.error("Unexpected error during Google sign-in:", error)
      // Track error
      trackAuthAction("error", "google")
      setIsLoading(false)
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleGoogleSignIn} disabled={isLoading} className={className}>
      {isLoading ? <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> : <Icons.google className="mr-2 h-4 w-4" />}
      {children}
    </Button>
  )
}
