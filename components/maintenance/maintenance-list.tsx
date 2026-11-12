"use client"

import { maintenanceTypeLabel } from "@/lib/data/maintenance-types"

/* eslint-disable unicorn/consistent-function-scoping -- Formatters stay inside the component to keep display logic local. */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Calendar, DollarSign, Gauge, MoreVertical, Edit, Trash2 } from "lucide-react"
import { EditMaintenanceDialog } from "./edit-maintenance-dialog"
import { DeleteMaintenanceDialog } from "./delete-maintenance-dialog"
import { useReducer } from "react"
import { formatDate, formatCurrency, formatMileage } from "@/lib/formatters"
import { MaintenanceSkeleton } from "@/components/skeletons/maintenance-skeleton"
import { NO_ROW_ACTION, transitionRowAction } from "@/lib/ui/row-action"

interface MaintenanceRecord {
  id: string
  type: string
  description?: string | null
  cost?: number | null
  mileage?: number | null
  service_date: string
  notes?: string | null
  created_at: string | null
}

interface MaintenanceListProps {
  records: MaintenanceRecord[]
  vehicleId: string
  isLoading?: boolean
}

export function MaintenanceList({ records, vehicleId, isLoading }: MaintenanceListProps) {
  const [rowAction, dispatchRowAction] = useReducer(transitionRowAction<MaintenanceRecord>, NO_ROW_ACTION)

  if (isLoading) {
    return <MaintenanceSkeleton />
  }

  return (
    <div className="space-y-4">
      {records.map((record) => (
        <Card key={record.id} className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-lg p-2">
                  <Calendar className="text-primary h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-foreground text-lg">{maintenanceTypeLabel(record.type)}</CardTitle>
                  <p className="text-muted-foreground text-sm">{formatDate(record.service_date)}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`Acciones del mantenimiento ${maintenanceTypeLabel(record.type)}`}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => dispatchRowAction({ type: "SELECT", action: "editing", row: record })}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => dispatchRowAction({ type: "SELECT", action: "deleting", row: record })}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {record.description && <p className="text-foreground text-sm">{record.description}</p>}

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="text-muted-foreground h-4 w-4" />
                <span className="text-foreground font-medium">{formatCurrency(record.cost ?? null)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">{formatMileage(record.mileage ?? null)}</span>
              </div>
            </div>

            {record.notes && (
              <div className="border-border border-t pt-3">
                <h4 className="text-foreground mb-1 text-sm font-medium">Notas:</h4>
                <p className="text-muted-foreground text-sm">{record.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {rowAction.status === "editing" && (
        <EditMaintenanceDialog
          record={rowAction.row}
          vehicleId={vehicleId}
          open
          onOpenChange={(open) => !open && dispatchRowAction({ type: "CLEAR", action: "editing" })}
        />
      )}

      {rowAction.status === "deleting" && (
        <DeleteMaintenanceDialog
          record={rowAction.row}
          open
          onOpenChange={(open) => !open && dispatchRowAction({ type: "CLEAR", action: "deleting" })}
        />
      )}
    </div>
  )
}
