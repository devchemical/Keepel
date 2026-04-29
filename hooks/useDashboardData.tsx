"use client"

import { useState, useEffect, useCallback } from "react"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/hooks/useAuth"
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

interface DashboardData {
  vehicles: Vehicle[]
  maintenanceRecords: any[]
  upcomingMaintenance: ScheduledService[]
}

export function useDashboardData(): DashboardData & {
  user: any
  profile: any
  isLoading: boolean
  signOut: () => Promise<void>
  refreshData: () => Promise<void>
} {
  const { user, profile, isLoading: authLoading, signOut } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([])
  const [upcomingMaintenance, setUpcomingMaintenance] = useState<ScheduledService[]>([])
  const [isDataLoading, setIsDataLoading] = useState(false)
  const supabase = useSupabase()

  const loadVehicles = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("vehicles")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Vehicles error:", error)
          setVehicles([])
        } else if (data) {
          setVehicles(data)
        } else {
          setVehicles([])
        }
      } catch (error) {
        console.error("Vehicles load error:", error)
        setVehicles([])
      }
    },
    [supabase]
  )

  const loadMaintenanceRecords = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("maintenance_records")
          .select(
            `
          *,
          vehicles (
            make,
            model,
            year
          )
        `
          )
          .eq("user_id", userId)
          .order("service_date", { ascending: false })
          .limit(10)

        if (error) {
          console.error("Maintenance records error:", error)
          setMaintenanceRecords([])
        } else if (data) {
          // Los datos ya tienen el campo 'type' según el esquema
          const transformedData = data.map((record) => ({
            ...record,
            vehicles: record.vehicles,
          }))
          setMaintenanceRecords(transformedData)
        } else {
          setMaintenanceRecords([])
        }
      } catch (error) {
        console.error("Maintenance records load error:", error)
        setMaintenanceRecords([])
      }
    },
    [supabase]
  )

  const loadUpcomingMaintenance = useCallback(
    async (userId: string) => {
      try {
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

        const { data, error } = await supabase
          .from("scheduled_services")
          .select(
            `
            *,
            vehicles (
              make,
              model,
              year,
              license_plate
            )
          `
          )
          .eq("user_id", userId)
          .eq("status", "pending")
          .lte("scheduled_date", thirtyDaysFromNow.toISOString().split("T")[0])
          .order("scheduled_date", { ascending: true, nullsFirst: true })

        if (error) {
          console.error("Upcoming maintenance error:", error)
          setUpcomingMaintenance([])
        } else if (data) {
          setUpcomingMaintenance(data as ScheduledService[])
        } else {
          setUpcomingMaintenance([])
        }
      } catch (error) {
        console.error("Upcoming maintenance load error:", error)
        setUpcomingMaintenance([])
      }
    },
    [supabase]
  )

  // Cargar datos cuando el usuario esté disponible
  useEffect(() => {
    if (!authLoading && user?.id) {
      setIsDataLoading(true)
      Promise.all([loadVehicles(user.id), loadMaintenanceRecords(user.id), loadUpcomingMaintenance(user.id)]).finally(
        () => {
          setIsDataLoading(false)
        }
      )
    } else if (!authLoading && !user) {
      // Limpiar datos cuando no hay usuario
      setVehicles([])
      setMaintenanceRecords([])
      setUpcomingMaintenance([])
      setIsDataLoading(false)
    }
  }, [user?.id, authLoading, loadVehicles, loadMaintenanceRecords, loadUpcomingMaintenance])

  const refreshData = useCallback(async () => {
    if (user?.id) {
      setIsDataLoading(true)
      try {
        await Promise.all([loadVehicles(user.id), loadMaintenanceRecords(user.id), loadUpcomingMaintenance(user.id)])
      } catch (error) {
        console.error("Error refreshing data:", error)
      } finally {
        setIsDataLoading(false)
      }
    }
  }, [user?.id, loadVehicles, loadMaintenanceRecords, loadUpcomingMaintenance])

  return {
    user,
    profile,
    vehicles,
    maintenanceRecords,
    upcomingMaintenance,
    isLoading: authLoading || isDataLoading,
    signOut,
    refreshData,
  }
}
