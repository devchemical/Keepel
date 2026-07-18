import { PasswordLoginForm } from "@/components/auth/password-login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Layout } from "@/components/layout/Layout"
import { sanitizeInternalRedirect } from "@/lib/auth/redirects"

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string | string[] }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams
  const redirectTo = sanitizeInternalRedirect(redirect)

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
              <PasswordLoginForm redirectTo={redirectTo} />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
