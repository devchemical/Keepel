import Link from "next/link"
import { GoogleSignInButton } from "@/components/auth/google-signin-button"
import { SignupForm } from "@/components/auth/signup-form"
import { Layout } from "@/components/layout/Layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SignUpPage() {
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
                <GoogleSignInButton className="cursor-pointer">Crear cuenta con Google</GoogleSignInButton>
              </div>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background text-muted-foreground px-2">O continúa con email</span>
                </div>
              </div>

              <SignupForm />

              <div className="text-muted-foreground mt-4 text-center text-sm">
                ¿Ya tienes una cuenta?{" "}
                <Link href="/auth/login" className="text-primary hover:text-primary/80 underline underline-offset-4">
                  Inicia sesión
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
