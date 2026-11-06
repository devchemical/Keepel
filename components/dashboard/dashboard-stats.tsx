"use client"

/* eslint-disable react/no-array-index-key, unicorn/consistent-function-scoping -- Static skeleton placeholders have no ids; formatter stays near usage for readability. */

import { useData } from "@/contexts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Car, Wrench, DollarSign, Calendar } from "lucide-react"

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
}

interface DashboardStatsProps {
  vehicles: Vehicle[]
  reminderCount: number
  isLoading?: boolean
}

export function DashboardStats({ vehicles, reminderCount, isLoading }: DashboardStatsProps) {
  const { totals } = useData()
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
  const totalMaintenanceRecords = totals?.record_count
  const totalCost = totals?.total_cost

  const upcomingServices = reminderCount

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
      value: totalMaintenanceRecords?.toString() ?? "—",
      icon: Wrench,
      description: "Servicios realizados",
      color: "text-blue-600",
    },
    {
      title: "Gasto Total",
      value: totalCost === undefined ? "—" : formatCurrency(totalCost),
      icon: DollarSign,
      description: "En mantenimientos",
      color: "text-green-700",
    },
    {
      title: "Próximos Servicios",
      value: upcomingServices.toString(),
      icon: Calendar,
      description: "Vencidos y próximos 30 días",
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
