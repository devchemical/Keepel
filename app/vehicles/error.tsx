"use client"

import { Button } from "@/components/ui/button"

/** Rendered inside the authenticated application shell, so navigation stays available while the view recovers. */
export default function VehiclesError({ reset }: { reset: () => void }) {
  return (
    <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12" role="alert">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">No se pudo cargar esta vista</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          La navegación sigue disponible. Vuelve a intentarlo para continuar.
        </p>
        <Button type="button" className="mt-4" onClick={reset}>
          Volver a intentar
        </Button>
      </div>
    </section>
  )
}
