"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useSupabase } from "./SupabaseContext"
import { useAuth } from "./AuthContext"

export interface Vehicle {
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

export interface MaintenanceRecord {
  id: string
  vehicle_id: string
  user_id: string
  type: string
  description?: string
  cost: number
  service_date: string
  mileage: number
  notes?: string
  created_at: string
  updated_at: string
  vehicles?: {
    make: string
    model: string
    year: number
  }
}

export type ScheduledServiceStatus = "pending" | "completed" | "cancelled"

export interface ScheduledService {
  id: string
  vehicle_id: string
  user_id: string
  type: string
  description?: string
  scheduled_date?: string
  scheduled_mileage?: number
  status: ScheduledServiceStatus
  notes?: string
  completed_record_id?: string
  created_at: string
  updated_at: string
  vehicles?: {
    make: string
    model: string
    year: number
    license_plate?: string
  }
}

interface DataContextType {
  // Data
  vehicles: Vehicle[]
  maintenanceRecords: MaintenanceRecord[]
  scheduledServices: ScheduledService[]

  // Loading states
  isLoading: boolean
  isVehiclesLoading: boolean
  isMaintenanceLoading: boolean
  isScheduledServicesLoading: boolean

  // Actions
  refreshAll: () => Promise<void>
  refreshVehicles: () => Promise<void>
  refreshMaintenance: () => Promise<void>
  refreshScheduledServices: () => Promise<void>

  // Optimistic updates - Vehicles
  addVehicleOptimistic: (vehicle: Omit<Vehicle, "id" | "created_at" | "updated_at">) => Promise<void>
  updateVehicleOptimistic: (id: string, updates: Partial<Vehicle>) => Promise<void>
  deleteVehicleOptimistic: (id: string) => Promise<void>

  // Optimistic updates - Maintenance
  addMaintenanceOptimistic: (record: Omit<MaintenanceRecord, "id" | "created_at" | "updated_at">) => Promise<void>
  updateMaintenanceOptimistic: (id: string, updates: Partial<MaintenanceRecord>) => Promise<void>
  deleteMaintenanceOptimistic: (id: string) => Promise<void>

  // Optimistic updates - Scheduled Services
  addScheduledServiceOptimistic: (
    service: Omit<ScheduledService, "id" | "created_at" | "updated_at" | "vehicles">
  ) => Promise<void>
  updateScheduledServiceOptimistic: (id: string, updates: Partial<ScheduledService>) => Promise<void>
  deleteScheduledServiceOptimistic: (id: string) => Promise<void>
  completeScheduledServiceOptimistic: (id: string, completedRecordId: string) => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

interface DataProviderProps {
  children: React.ReactNode
}

export function DataProvider({ children }: DataProviderProps) {
  const { user, isAuthenticated } = useAuth()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([])
  const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([])

  const [isVehiclesLoading, setIsVehiclesLoading] = useState(true)
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(true)
  const [isScheduledServicesLoading, setIsScheduledServicesLoading] = useState(true)

  const supabase = useSupabase()

  const loadVehicles = useCallback(
    async (userId: string) => {
      if (!userId) return

      setIsVehiclesLoading(true)
      try {
        // Crear promesa con timeout de 10 segundos
        const queryPromise = supabase
          .from("vehicles")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout al cargar vehículos (10s)")), 10000)
        )

        const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as any

        if (error) {
          console.error("Error loading vehicles:", error)
          setVehicles([])
        } else if (data) {
          setVehicles(data)
        } else {
          setVehicles([])
        }
      } catch (error) {
        console.error("Error loading vehicles:", error)
        setVehicles([])
      } finally {
        setIsVehiclesLoading(false)
      }
    },
    [supabase]
  )

  const loadMaintenanceRecords = useCallback(
    async (userId: string) => {
      if (!userId) return

      setIsMaintenanceLoading(true)

      try {
        const queryPromise = supabase
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

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout al cargar registros de mantenimiento (10s)")), 10000)
        )

        const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as any

        if (error) {
          console.error("Error loading maintenance records:", error)
          setMaintenanceRecords([])
        } else if (data) {
          setMaintenanceRecords([...data])
        } else {
          setMaintenanceRecords([])
        }
      } catch (error) {
        console.error("Error loading maintenance records:", error)
        setMaintenanceRecords([])
      } finally {
        setIsMaintenanceLoading(false)
      }
    },
    [supabase]
  )

  const loadScheduledServices = useCallback(
    async (userId: string) => {
      if (!userId) return

      setIsScheduledServicesLoading(true)
      try {
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
          .order("scheduled_date", { ascending: true, nullsFirst: true })

        if (error) {
          console.error("Error loading scheduled services:", error)
          setScheduledServices([])
        } else if (data) {
          setScheduledServices(data as ScheduledService[])
        } else {
          setScheduledServices([])
        }
      } catch (error) {
        console.error("Scheduled services load error:", error)
        setScheduledServices([])
      } finally {
        setIsScheduledServicesLoading(false)
      }
    },
    [supabase]
  )

  const refreshVehicles = useCallback(async () => {
    if (user?.id) {
      await loadVehicles(user.id)
    }
  }, [user?.id, loadVehicles])

  const refreshMaintenance = useCallback(async () => {
    if (user?.id) {
      await loadMaintenanceRecords(user.id)
    }
  }, [user?.id, loadMaintenanceRecords])

  const refreshScheduledServices = useCallback(async () => {
    if (user?.id) {
      await loadScheduledServices(user.id)
    }
  }, [user?.id, loadScheduledServices])

  const refreshAll = useCallback(async () => {
    if (user?.id) {
      await Promise.all([
        loadVehicles(user.id),
        loadMaintenanceRecords(user.id),
        loadScheduledServices(user.id),
      ])
    }
  }, [user?.id, loadVehicles, loadMaintenanceRecords, loadScheduledServices])

  // Optimistic update functions
  const addVehicleOptimistic = useCallback(
    async (vehicleData: Omit<Vehicle, "id" | "created_at" | "updated_at">) => {
      if (!user?.id) return

      // Create optimistic vehicle
      const optimisticVehicle: Vehicle = {
        id: `temp-${Date.now()}`,
        ...vehicleData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Add optimistically
      setVehicles((prev) => [optimisticVehicle, ...prev])

      try {
        const { data, error } = await supabase
          .from("vehicles")
          .insert({ ...vehicleData, user_id: user.id })
          .select()
          .single()

        if (error) throw error

        // Replace optimistic with real data
        setVehicles((prev) => prev.map((v) => (v.id === optimisticVehicle.id ? data : v)))
      } catch (error) {
        // Revert optimistic update
        setVehicles((prev) => prev.filter((v) => v.id !== optimisticVehicle.id))
        throw error
      }
    },
    [user?.id, supabase]
  )

  const updateVehicleOptimistic = useCallback(
    async (id: string, updates: Partial<Vehicle>) => {
      // Update optimistically
      setVehicles((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...updates, updated_at: new Date().toISOString() } : v))
      )

      try {
        const { error } = await supabase.from("vehicles").update(updates).eq("id", id)

        if (error) throw error

        // Refresh to get accurate data
        await refreshVehicles()
      } catch (error) {
        // Revert optimistic update
        await refreshVehicles()
        throw error
      }
    },
    [supabase, refreshVehicles]
  )

  const deleteVehicleOptimistic = useCallback(
    async (id: string) => {
      const vehicleToDelete = vehicles.find((v) => v.id === id)

      // Remove optimistically
      setVehicles((prev) => prev.filter((v) => v.id !== id))

      try {
        const { error } = await supabase.from("vehicles").delete().eq("id", id)

        if (error) throw error
      } catch (error) {
        // Revert optimistic update
        if (vehicleToDelete) {
          setVehicles((prev) => [vehicleToDelete, ...prev])
        }
        throw error
      }
    },
    [vehicles, supabase]
  )

  const addMaintenanceOptimistic = useCallback(
    async (recordData: Omit<MaintenanceRecord, "id" | "created_at" | "updated_at">) => {
      if (!user?.id) return

      const optimisticRecord: MaintenanceRecord = {
        id: `temp-${Date.now()}`,
        ...recordData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setMaintenanceRecords((prev) => [optimisticRecord, ...prev])

      try {
        const { data, error } = await supabase
          .from("maintenance_records")
          .insert({ ...recordData, user_id: user.id })
          .select()
          .single()

        if (error) throw error

        setMaintenanceRecords((prev) => prev.map((r) => (r.id === optimisticRecord.id ? data : r)))
      } catch (error) {
        setMaintenanceRecords((prev) => prev.filter((r) => r.id !== optimisticRecord.id))
        throw error
      }
    },
    [user?.id, supabase]
  )

  const updateMaintenanceOptimistic = useCallback(
    async (id: string, updates: Partial<MaintenanceRecord>) => {
      setMaintenanceRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates, updated_at: new Date().toISOString() } : r))
      )

      try {
        const { error } = await supabase.from("maintenance_records").update(updates).eq("id", id)

        if (error) throw error

        await refreshMaintenance()
      } catch (error) {
        await refreshMaintenance()
        throw error
      }
    },
    [supabase, refreshMaintenance]
  )

  const deleteMaintenanceOptimistic = useCallback(
    async (id: string) => {
      const recordToDelete = maintenanceRecords.find((r) => r.id === id)

      setMaintenanceRecords((prev) => prev.filter((r) => r.id !== id))

      try {
        const { error } = await supabase.from("maintenance_records").delete().eq("id", id)

        if (error) throw error
      } catch (error) {
        if (recordToDelete) {
          setMaintenanceRecords((prev) => [recordToDelete, ...prev])
        }
        throw error
      }
    },
    [maintenanceRecords, supabase]
  )

  const addScheduledServiceOptimistic = useCallback(
    async (serviceData: Omit<ScheduledService, "id" | "created_at" | "updated_at" | "vehicles">) => {
      if (!user?.id) return

      const optimisticService: ScheduledService = {
        id: `temp-${Date.now()}`,
        ...serviceData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setScheduledServices((prev) => [optimisticService, ...prev])

      try {
        const { data, error } = await supabase
          .from("scheduled_services")
          .insert({ ...serviceData, user_id: user.id })
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
          .single()

        if (error) throw error

        setScheduledServices((prev) => prev.map((s) => (s.id === optimisticService.id ? (data as ScheduledService) : s)))
      } catch (error) {
        setScheduledServices((prev) => prev.filter((s) => s.id !== optimisticService.id))
        throw error
      }
    },
    [user?.id, supabase]
  )

  const updateScheduledServiceOptimistic = useCallback(
    async (id: string, updates: Partial<ScheduledService>) => {
      setScheduledServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s))
      )

      try {
        const { error } = await supabase.from("scheduled_services").update(updates).eq("id", id)

        if (error) throw error

        await refreshScheduledServices()
      } catch (error) {
        await refreshScheduledServices()
        throw error
      }
    },
    [supabase, refreshScheduledServices]
  )

  const deleteScheduledServiceOptimistic = useCallback(
    async (id: string) => {
      const serviceToDelete = scheduledServices.find((s) => s.id === id)

      setScheduledServices((prev) => prev.filter((s) => s.id !== id))

      try {
        const { error } = await supabase.from("scheduled_services").delete().eq("id", id)

        if (error) throw error
      } catch (error) {
        if (serviceToDelete) {
          setScheduledServices((prev) => [serviceToDelete, ...prev])
        }
        throw error
      }
    },
    [scheduledServices, supabase]
  )

  const completeScheduledServiceOptimistic = useCallback(
    async (id: string, completedRecordId: string) => {
      setScheduledServices((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: "completed" as ScheduledServiceStatus, completed_record_id: completedRecordId, updated_at: new Date().toISOString() }
            : s
        )
      )

      try {
        const { error } = await supabase
          .from("scheduled_services")
          .update({ status: "completed", completed_record_id: completedRecordId, updated_at: new Date().toISOString() })
          .eq("id", id)

        if (error) throw error

        await refreshScheduledServices()
      } catch (error) {
        await refreshScheduledServices()
        throw error
      }
    },
    [supabase, refreshScheduledServices]
  )

  // Load data when user changes - only once per auth state change
  const hasLoadedRef = React.useRef(false)

  useEffect(() => {
    if (isAuthenticated && user?.id && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      refreshAll()
    } else if (!isAuthenticated) {
      // Clear data when user logs out
      hasLoadedRef.current = false
      setVehicles([])
      setMaintenanceRecords([])
      setScheduledServices([])
      // Reset loading states
      setIsVehiclesLoading(false)
      setIsMaintenanceLoading(false)
      setIsScheduledServicesLoading(false)
    }
  }, [isAuthenticated, user?.id])

  const value: DataContextType = {
    // Data
    vehicles,
    maintenanceRecords,
    scheduledServices,

    // Loading states
    isLoading: isVehiclesLoading || isMaintenanceLoading || isScheduledServicesLoading,
    isVehiclesLoading,
    isMaintenanceLoading,
    isScheduledServicesLoading,

    // Actions
    refreshAll,
    refreshVehicles,
    refreshMaintenance,
    refreshScheduledServices,

    // Optimistic updates - Vehicles
    addVehicleOptimistic,
    updateVehicleOptimistic,
    deleteVehicleOptimistic,

    // Optimistic updates - Maintenance
    addMaintenanceOptimistic,
    updateMaintenanceOptimistic,
    deleteMaintenanceOptimistic,

    // Optimistic updates - Scheduled Services
    addScheduledServiceOptimistic,
    updateScheduledServiceOptimistic,
    deleteScheduledServiceOptimistic,
    completeScheduledServiceOptimistic,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextType {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}
