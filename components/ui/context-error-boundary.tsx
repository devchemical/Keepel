"use client"

import React from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export class ContextErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Context Error Boundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="from-background to-muted flex min-h-screen items-center justify-center bg-gradient-to-br">
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
            <AlertCircle className="text-destructive h-12 w-12" />
            <h2 className="text-foreground text-xl font-semibold">Error de Inicialización</h2>
            <p className="text-muted-foreground">
              Hubo un problema al cargar la aplicación. Por favor, recarga la página.
            </p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Recargar Página
            </Button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 text-left text-sm">
                <summary className="text-muted-foreground cursor-pointer">Detalles del error (desarrollo)</summary>
                <pre className="bg-muted mt-2 overflow-x-auto rounded p-2 text-xs">
                  {this.state.error.message}
                  {"\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
