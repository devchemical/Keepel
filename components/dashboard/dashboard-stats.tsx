"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Car, Wrench, DollarSign, AlertTriangle } from "lucide-react"

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
}

interface MaintenanceRecord {
  id: string
  cost?: number
  next_service_date?: string
}

interface DashboardStatsProps {
  vehicles: Vehicle[]
  maintenanceRecords: MaintenanceRecord[]
  isLoading?: boolean
}

export function DashboardStats({ vehicles, maintenanceRecords, isLoading }: DashboardStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-1.5 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  const totalVehicles = vehicles.length
  const totalMaintenanceRecords = maintenanceRecords.length

  const totalCost = maintenanceRecords.reduce((sum, record) => {
    return sum + (record.cost || 0)
  }, 0)

  const upcomingServices = maintenanceRecords.filter((record) => {
    if (!record.next_service_date) return false
    const nextDate = new Date(record.next_service_date)
    const today = new Date()
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    return nextDate >= today && nextDate <= thirtyDaysFromNow
  }).length

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(amount)
  }

  const stats = [
    {
      title: "Total Vehículos",
      value: totalVehicles.toString(),
      icon: Car,
      description: "Vehículos registrados",
      color: "text-green-700",
    },
    {
      title: "Mantenimientos",
      value: totalMaintenanceRecords.toString(),
      icon: Wrench,
      description: "Servicios realizados",
      color: "text-blue-600",
    },
    {
      title: "Gasto Total",
      value: formatCurrency(totalCost),
      icon: DollarSign,
      description: "En mantenimientos",
      color: "text-green-700",
    },
    {
      title: "Próximos Servicios",
      value: upcomingServices.toString(),
      icon: AlertTriangle,
      description: "En los próximos 30 días",
      color: upcomingServices > 0 ? "text-amber-600" : "text-muted-foreground",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-muted-foreground text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-5 w-5 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-foreground text-2xl font-semibold tracking-tight">{stat.value}</div>
            <p className="text-muted-foreground mt-1.5 text-xs">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
