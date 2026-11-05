"use client"
import { useData } from "@/contexts"
import { OperationRecovery } from "./operation-recovery"
import { Button } from "@/components/ui/button"

export function DataRecovery() {
  const { loadError, refreshAll, isLoading } = useData()
  return (
    <div className="mb-4 space-y-2">
      <OperationRecovery />
      {loadError && <p role="alert">{loadError}</p>}
      <Button variant="outline" disabled={isLoading} onClick={() => void refreshAll()}>
        {loadError ? "Reintentar carga" : "Actualizar datos"}
      </Button>
    </div>
  )
}
