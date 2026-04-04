"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import Image from "next/image"
import { Car, Shield, Calendar, BarChart3, Users, CheckCircle } from "lucide-react"

export function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-foreground mb-6 text-5xl leading-tight font-bold">
            Gestiona el cuidado de tu <span className="text-primary">vehículo</span> de manera{" "}
            <span className="text-primary">inteligente</span>
          </h2>
          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-xl">
            Mantén un registro completo del mantenimiento, recibe recordatorios personalizados y prolonga la vida útil
            de tu automóvil con Keepel.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90" data-track="landing_signup_click">
              <Link href="/auth/signup">Comenzar Gratis</Link>
            </Button>
            <Button size="lg" variant="outline" asChild data-track="landing_login_click">
              <Link href="/auth/login">Iniciar Sesión</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mb-12 text-center">
          <h3 className="text-foreground mb-4 text-3xl font-bold">Todo lo que necesitas para cuidar tu vehículo</h3>
          <p className="text-muted-foreground text-lg">Herramientas profesionales al alcance de todos</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center">
              <Car className="text-primary mx-auto mb-4 h-12 w-12" />
              <CardTitle className="text-xl">Registro de Vehículos</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Gestiona múltiples vehículos con información detallada y fotografías.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center">
              <Calendar className="text-primary mx-auto mb-4 h-12 w-12" />
              <CardTitle className="text-xl">Recordatorios</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Recibe notificaciones automáticas sobre próximos mantenimientos y servicios.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center">
              <BarChart3 className="text-primary mx-auto mb-4 h-12 w-12" />
              <CardTitle className="text-xl">Análisis</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Visualiza estadísticas de costos, frecuencia y patrones de mantenimiento.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center">
              <Shield className="text-primary mx-auto mb-4 h-12 w-12" />
              <CardTitle className="text-xl">Seguridad</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                Tus datos están protegidos con encriptación de nivel empresarial.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-card/30 rounded-3xl p-4 sm:p-8 lg:p-12">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h3 className="text-foreground mb-6 text-3xl font-bold">Beneficios de usar Keepel</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-primary mt-0.5 h-6 w-6 flex-shrink-0" />
                  <div>
                    <h4 className="text-foreground font-semibold">Ahorra dinero</h4>
                    <p className="text-muted-foreground">
                      Prevén reparaciones costosas con mantenimiento preventivo oportuno.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-primary mt-0.5 h-6 w-6 flex-shrink-0" />
                  <div>
                    <h4 className="text-foreground font-semibold">Prolonga la vida útil</h4>
                    <p className="text-muted-foreground">Mantén tu vehículo en óptimas condiciones por más tiempo.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-primary mt-0.5 h-6 w-6 flex-shrink-0" />
                  <div>
                    <h4 className="text-foreground font-semibold">Aumenta el valor de reventa</h4>
                    <p className="text-muted-foreground">
                      Un historial completo de mantenimiento incrementa el valor de tu auto.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-primary mt-0.5 h-6 w-6 flex-shrink-0" />
                  <div>
                    <h4 className="text-foreground font-semibold">Tranquilidad total</h4>
                    <p className="text-muted-foreground">
                      Nunca más olvides un cambio de aceite o revisión importante.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="from-primary/20 to-primary/5 rounded-2xl bg-gradient-to-br p-8 text-center">
              <Users className="text-primary mx-auto mb-4 h-16 w-16" />
              <h4 className="text-foreground mb-2 text-2xl font-bold">+10,000 usuarios confían en nosotros</h4>
              <p className="text-muted-foreground">
                Únete a la comunidad de propietarios responsables que cuidan sus vehículos de manera profesional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-12 text-center">
            <h3 className="text-foreground mb-4 text-3xl font-bold">¿Listo para comenzar?</h3>
            <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
              Únete a miles de usuarios que ya confían en Keepel para mantener sus vehículos en perfecto estado.
            </p>
            <Button size="lg" asChild className="bg-primary hover:bg-primary/90">
              <Link href="/auth/signup">Crear Cuenta Gratis</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-border/50 bg-background/80 border-t backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Image src="/logo_keepel_grueso.svg" alt="Keepel" width={20} height={20} />
            <span className="text-foreground text-lg font-semibold">Keepel</span>
          </div>
          <p className="text-muted-foreground text-sm">© 2026 Keepel. Todos los derechos reservados.</p>
        </div>
      </footer>
    </>
  )
}
