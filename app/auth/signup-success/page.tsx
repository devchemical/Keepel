import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Mail } from "lucide-react"
import { Layout } from "@/components/layout/Layout"

export default function SignUpSuccessPage() {
  return (
    <Layout showHeader={true}>
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="bg-primary/10 rounded-full p-3">
                  <Mail className="text-primary h-8 w-8" />
                </div>
              </div>
              <CardTitle className="text-foreground text-2xl">¡Cuenta Creada Exitosamente!</CardTitle>
              <CardDescription className="text-muted-foreground">Verifica tu email para continuar</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6 text-sm">
                Te hemos enviado un enlace de confirmación a tu email. Por favor, revisa tu bandeja de entrada y haz
                clic en el enlace para activar tu cuenta.
              </p>
              <div className="space-y-3">
                <Button asChild className="bg-primary hover:bg-primary/90 w-full">
                  <Link href="/auth/login">Ir a Iniciar Sesión</Link>
                </Button>
                <p className="text-muted-foreground text-xs">¿No recibiste el email? Revisa tu carpeta de spam.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
