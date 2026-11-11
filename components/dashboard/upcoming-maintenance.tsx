"use client"

/* eslint-disable react/no-array-index-key -- Static skeleton placeholders have no ids. */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Calendar, AlertTriangle, CheckCircle, Car, MoreVertical, Edit, ChevronDown, Clock } from "lucide-react"
import { useId, useReducer, useState } from "react"
import { useData } from "@/contexts"
import { toast } from "sonner"
import { AddMaintenanceDialog } from "@/components/maintenance/add-maintenance-dialog"
import { EditScheduledServiceDialog } from "@/components/maintenance/edit-scheduled-service-dialog"

import type { ScheduledService } from "@/contexts"
import type { ScheduleLater, ScheduleReminder, ScheduledServiceRow } from "@/lib/data/scheduled-services"
import { formatCalendarDay } from "@/lib/data/calendar-day"
import { maintenanceTypeLabel } from "@/lib/data/maintenance-types"
import { OPERATION_SUCCESS_MESSAGES, operationMessage } from "@/lib/data/operation-messages"
import { NO_ROW_ACTION, transitionRowAction } from "@/lib/ui/row-action"

type RowSelection = { action: "completing" | "editing"; row: ScheduledService }

interface UpcomingMaintenanceProps {
  upcomingMaintenance: ScheduledServiceRow<ScheduledService, ScheduleReminder>[]
  /** Pending forecasts beyond the reminder horizon; listed collapsed and never counted. */
  laterMaintenance?: ScheduledServiceRow<ScheduledService, ScheduleLater>[]
  isLoading?: boolean
}

export function UpcomingMaintenance({
  upcomingMaintenance,
  laterMaintenance = [],
  isLoading,
}: UpcomingMaintenanceProps) {
  const { cancelScheduledService } = useData()
  const [rowAction, dispatchRowAction] = useReducer(transitionRowAction<ScheduledService>, NO_ROW_ACTION)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [showLater, setShowLater] = useState(false)
  const laterListId = useId()
  const select = ({ action, row }: RowSelection) => dispatchRowAction({ type: "SELECT", action, row })

  const cancel = async (id: string) => {
    if (cancellingId) return
    setCancellingId(id)
    try {
      const message = operationMessage("crud", await cancelScheduledService(id))
      if (message) toast.error(message)
      else toast.success(OPERATION_SUCCESS_MESSAGES["schedule.cancel"])
    } catch {
      toast.error("No se pudo confirmar la cancelación")
    } finally {
      setCancellingId(null)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="mt-2 h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 rounded-xl border p-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasReminders = upcomingMaintenance.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-green-700" />
          Próximos Mantenimientos
        </CardTitle>
        <CardDescription>
          {hasReminders
            ? `${upcomingMaintenance.length} servicio${upcomingMaintenance.length !== 1 ? "s" : ""} programado${upcomingMaintenance.length !== 1 ? "s" : ""}`
            : laterMaintenance.length > 0
              ? "No hay servicios en los próximos 30 días"
              : "No hay servicios programados"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasReminders ? (
          <div role="list" aria-label="Previsiones" className="space-y-3">
            {upcomingMaintenance.slice(0, showAll ? undefined : 5).map((row) => (
              <ScheduledServiceRow
                key={row.service.id}
                {...row}
                actionsDisabled={cancellingId !== null}
                onSelect={select}
                onCancel={(id) => void cancel(id)}
              />
            ))}

            {upcomingMaintenance.length > 5 && !showAll && (
              <div className="pt-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setShowAll(true)}>
                  Ver {upcomingMaintenance.length - 5} más
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-700" />
            <p className="leading-relaxed text-slate-500">
              ¡Perfecto! No tienes mantenimientos pendientes en los próximos 30 días.
            </p>
          </div>
        )}

        {laterMaintenance.length > 0 && (
          <div className="border-border mt-4 border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showLater}
              aria-controls={laterListId}
              data-state={showLater ? "expanded" : "collapsed"}
              onClick={() => setShowLater((open) => !open)}
              className="text-muted-foreground w-full justify-between"
            >
              <span>Más adelante ({laterMaintenance.length})</span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 transition-transform motion-reduce:transition-none ${showLater ? "rotate-180" : ""}`}
              />
            </Button>
            {showLater && (
              <div id={laterListId} role="list" aria-label="Más adelante" className="mt-3 space-y-3">
                {laterMaintenance.map((row) => (
                  <ScheduledServiceRow
                    key={row.service.id}
                    {...row}
                    actionsDisabled={cancellingId !== null}
                    onSelect={select}
                    onCancel={(id) => void cancel(id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {rowAction.status === "completing" && (
        <AddMaintenanceDialog
          vehicleId={rowAction.row.vehicle_id}
          initialScheduledServiceId={rowAction.row.id}
          open
          onOpenChange={(open) => !open && dispatchRowAction({ type: "CLEAR", action: "completing" })}
        />
      )}
      {rowAction.status === "editing" && (
        <EditScheduledServiceDialog
          service={rowAction.row}
          open
          onOpenChange={(open) => !open && dispatchRowAction({ type: "CLEAR", action: "editing" })}
        />
      )}
    </Card>
  )
}

type ScheduledServiceRowProps = ScheduledServiceRow<ScheduledService> & {
  actionsDisabled: boolean
  onSelect: (selection: RowSelection) => void
  onCancel: (id: string) => void
}

function ScheduledServiceRow({
  service: maintenance,
  daysUntil,
  urgency,
  actionsDisabled,
  onSelect,
  onCancel,
}: ScheduledServiceRowProps) {
  const scheduledDate = maintenance.scheduled_date
  const overdue = urgency === "overdue"
  const later = urgency === "later"
  const serviceLabel = maintenanceTypeLabel(maintenance.type)
  const accessibleName = maintenance.description || serviceLabel

  return (
    <div
      role="listitem"
      aria-label={accessibleName}
      data-urgency={urgency}
      className="flex items-start gap-4 rounded-xl border border-slate-100 bg-white p-4 transition-colors hover:bg-slate-50/50"
    >
      <div className={`rounded-xl p-2.5 ${overdue ? "bg-red-50" : later ? "bg-slate-100" : "bg-amber-50"}`}>
        {overdue ? (
          <AlertTriangle className="h-5 w-5 text-red-600" />
        ) : later ? (
          <Clock className="h-5 w-5 text-slate-500" />
        ) : (
          <Calendar className="h-5 w-5 text-amber-600" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900">{serviceLabel}</span>
          {!later && (
            <Badge
              variant={overdue ? "destructive" : "secondary"}
              className={`border-0 text-xs ${overdue ? "" : "bg-amber-100 text-amber-700"}`}
            >
              {overdue ? "Vencido" : urgency === "today" ? "Hoy" : `${daysUntil} días`}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Car className="h-3.5 w-3.5 text-slate-400" />
          {maintenance.vehicles && (
            <span>
              {maintenance.vehicles.make} {maintenance.vehicles.model} {maintenance.vehicles.year}
              {maintenance.vehicles.license_plate && <span className="text-slate-300"> •</span>}
              {maintenance.vehicles.license_plate && <span> {maintenance.vehicles.license_plate}</span>}
            </span>
          )}
        </div>

        <div className="mt-1.5 text-xs text-slate-500">
          {scheduledDate && formatCalendarDay(scheduledDate, { month: "short", day: "numeric" })}
          {typeof maintenance.scheduled_mileage === "number" && (
            <span> &middot; {maintenance.scheduled_mileage.toLocaleString("es-ES")} km</span>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Acciones de ${accessibleName}`} className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!later && (
            <DropdownMenuItem
              disabled={actionsDisabled}
              onClick={() => onSelect({ action: "completing", row: maintenance })}
            >
              Completar previsión
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled={actionsDisabled} onClick={() => onCancel(maintenance.id)}>
            Cancelar previsión
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={actionsDisabled}
            onClick={() => onSelect({ action: "editing", row: maintenance })}
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
