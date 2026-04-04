import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Car, AlertCircle } from "lucide-react"
import { Layout } from "../../../components/layout/Layout"

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error: string }> }) {
  const params = await searchParams

  return (
    <Layout showHeader={true}>
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="bg-destructive/10 rounded-full p-3">
                  <AlertCircle className="text-destructive h-8 w-8" />
                </div>
              </div>
              <CardTitle className="text-foreground text-2xl">Error de Autenticación</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              {params?.error ? (
                <p className="text-muted-foreground mb-6 text-sm">Código de error: {params.error}</p>
              ) : (
                <p className="text-muted-foreground mb-6 text-sm">
                  Ocurrió un error no especificado durante la autenticación.
                </p>
              )}
              <Button asChild className="bg-primary hover:bg-primary/90 w-full">
                <Link href="/auth/login">Volver a Iniciar Sesión</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
