"use client"

import { Car } from "lucide-react"

interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message = "Cargando..." }: LoadingScreenProps) {
  return (
    <div className="from-background to-muted flex min-h-screen items-center justify-center bg-gradient-to-br">
      <div className="flex flex-col items-center gap-4">
        <Car className="text-primary h-8 w-8 animate-pulse" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
