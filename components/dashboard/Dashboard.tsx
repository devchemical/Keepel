"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Car, CheckCircle } from "lucide-react"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { UpcomingMaintenance } from "@/components/dashboard/upcoming-maintenance"
import { VehicleOverview } from "@/components/dashboard/vehicle-overview"
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton"
import type { ScheduledService } from "@/contexts"

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  license_plate?: string
  vin?: string
  color?: string
  mileage: number
  created_at: string
  updated_at: string
}

interface Profile {
  id: string
  full_name?: string
  email: string
}

interface DashboardProps {
  user: {
    id: string
    email?: string
  }
  profile: Profile | null
  vehicles: Vehicle[]
  maintenanceRecords: any[]
  upcomingMaintenance: ScheduledService[]
  isLoading?: boolean
}

export function Dashboard({ user, profile, vehicles, maintenanceRecords, upcomingMaintenance, isLoading }: DashboardProps) {
  if (isLoading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-10">
        <h2 className="mb-2 text-3xl font-semibold tracking-tight text-slate-900">Panel de Control</h2>
        <p className="leading-relaxed text-slate-500">Resumen de tus vehículos y mantenimientos</p>
      </div>

      {/* Quick Actions */}
      <div className="mb-10 flex flex-wrap gap-3">
        <Button asChild className="bg-green-700 hover:bg-green-800" data-track="dashboard_view_vehicles_click">
          <Link href="/vehicles">
            <Car className="mr-2 h-4 w-4" />
            Ver Vehículos
          </Link>
        </Button>
        <Button variant="outline" asChild data-track="dashboard_add_vehicle_click">
          <Link href="/vehicles">
            <CheckCircle className="mr-2 h-4 w-4" />
            Agregar Vehículo
          </Link>
        </Button>
      </div>

      {/* Dashboard Stats */}
      <DashboardStats vehicles={vehicles} maintenanceRecords={maintenanceRecords} isLoading={isLoading} />

      {/* Main Content Grid */}
      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        {/* Left Column - Vehicle Overview */}
        <div className="space-y-8 lg:col-span-2">
          <VehicleOverview vehicles={vehicles} isLoading={isLoading} />
          <RecentActivity maintenanceRecords={maintenanceRecords} isLoading={isLoading} />
        </div>

        {/* Right Column - Upcoming Maintenance */}
        <div className="space-y-8">
          <UpcomingMaintenance upcomingMaintenance={upcomingMaintenance} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}
