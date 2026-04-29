"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddMaintenanceDialog } from "@/components/maintenance/add-maintenance-dialog"
import { ScheduleServiceDialog } from "@/components/maintenance/schedule-service-dialog"
import { Plus, Wrench, Calendar } from "lucide-react"

interface MaintenanceActionsDropdownProps {
  vehicleId: string
}

export function MaintenanceActionsDropdown({ vehicleId }: MaintenanceActionsDropdownProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Agregar</span>
            <span className="sm:hidden">Agregar</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAddOpen(true)}>
            <Wrench className="mr-2 h-4 w-4" />
            Registrar Mantenimiento
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setScheduleOpen(true)}>
            <Calendar className="mr-2 h-4 w-4" />
            Programar Servicio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddMaintenanceDialog vehicleId={vehicleId} open={addOpen} onOpenChange={setAddOpen}>
        <span />
      </AddMaintenanceDialog>
      <ScheduleServiceDialog vehicleId={vehicleId} open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <span />
      </ScheduleServiceDialog>
    </>
  )
}