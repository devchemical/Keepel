"use client"

/* eslint-disable no-console, typescript/no-explicit-any, react/exhaustive-deps, react/jsx-no-constructed-context-values -- Data load failures are diagnostic; Promise.race typing and one-shot auth-load behavior are intentional pending data-layer refactor. */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { resolveDataAuthTransition } from "./data-auth-transition"
import { useAuthProjection } from "./AuthProjectionContext"
import { useSupabase } from "./SupabaseContext"
import { AUTH_STATE_STATUS, type CurrentUser } from "@/lib/auth/contracts"
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types"
import { localToday } from "@/lib/data/calendar-day"
import {
  maintenanceCommandSchema,
  maintenanceRpcArgs,
  readMaintenanceReceipt,
  type MaintenanceCommand,
  type MaintenanceBatchResult,
  type MaintenanceReceipt,
} from "@/lib/data/maintenance-command"
import { prependOptimistic, removeOptimistic, replaceOptimistic } from "@/lib/data/optimistic-list"

type VehicleRow = Tables<"vehicles">
export type Vehicle = Omit<VehicleRow, "user_id" | "license_plate" | "vin" | "color"> &
  Partial<Pick<VehicleRow, "license_plate" | "vin" | "color">>
export type MaintenanceRecord = Tables<"maintenance_records"> & {
  vehicles?: Pick<VehicleRow, "make" | "model" | "year">
}
export type ScheduledServiceStatus = "pending" | "completed" | "cancelled"
type ScheduledRow = Tables<"scheduled_services">
export type ScheduledService = Omit<
  ScheduledRow,
  "status" | "description" | "scheduled_date" | "scheduled_mileage" | "notes" | "completed_record_id"
> &
  Partial<
    Pick<ScheduledRow, "description" | "scheduled_date" | "scheduled_mileage" | "notes" | "completed_record_id">
  > & {
    status: ScheduledServiceStatus
    vehicles?: Pick<VehicleRow, "make" | "model" | "year" | "license_plate">
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

  createMaintenanceBatch: (command: MaintenanceCommand) => Promise<MaintenanceBatchResult>
  reconcileMaintenanceBatch: (command: MaintenanceCommand) => Promise<MaintenanceBatchResult>

  // Optimistic updates - Maintenance
  addMaintenanceOptimistic: (record: Omit<MaintenanceRecord, "id" | "created_at" | "updated_at">) => Promise<void>
  updateMaintenanceOptimistic: (id: string, updates: TablesUpdate<"maintenance_records">) => Promise<void>
  deleteMaintenanceOptimistic: (id: string) => Promise<void>

  // Optimistic updates - Scheduled Services
  addScheduledServiceOptimistic: (
    service: Omit<ScheduledService, "id" | "created_at" | "updated_at" | "vehicles">
  ) => Promise<void>
  updateScheduledServiceOptimistic: (
    id: string,
    updates: TablesUpdate<"scheduled_services"> & { status?: ScheduledServiceStatus }
  ) => Promise<void>
  deleteScheduledServiceOptimistic: (id: string) => Promise<void>
  completeScheduledServiceOptimistic: (id: string, completedRecordId: string) => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

interface DataProviderProps {
  children: React.ReactNode
}

export function DataProvider({ children }: DataProviderProps) {
  const authState = useAuthProjection()
  const userId = authState.status === AUTH_STATE_STATUS.AUTHENTICATED ? authState.user.id : null
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([])
  const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([])

  const [isVehiclesLoading, setIsVehiclesLoading] = useState(true)
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(true)
  const [isScheduledServicesLoading, setIsScheduledServicesLoading] = useState(true)

  const supabase = useSupabase()

  const loadVehicles = useCallback(
    async (currentUserId: CurrentUser["id"]) => {
      if (!currentUserId) return

      setIsVehiclesLoading(true)
      try {
        // Crear promesa con timeout de 10 segundos
        const queryPromise = supabase
          .from("vehicles")
          .select("*")
          .eq("user_id", currentUserId)
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
    async (currentUserId: CurrentUser["id"]) => {
      if (!currentUserId) return

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
          .eq("user_id", currentUserId)
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
    async (currentUserId: CurrentUser["id"]) => {
      if (!currentUserId) return

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
          .eq("user_id", currentUserId)
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

  const loadAllForUser = useCallback(
    async (currentUserId: CurrentUser["id"]) => {
      await Promise.all([
        loadVehicles(currentUserId),
        loadMaintenanceRecords(currentUserId),
        loadScheduledServices(currentUserId),
      ])
    },
    [loadVehicles, loadMaintenanceRecords, loadScheduledServices]
  )

  const refreshVehicles = useCallback(async () => {
    if (userId) {
      await loadVehicles(userId)
    }
  }, [userId, loadVehicles])

  const refreshMaintenance = useCallback(async () => {
    if (userId) {
      await loadMaintenanceRecords(userId)
    }
  }, [userId, loadMaintenanceRecords])

  const refreshScheduledServices = useCallback(async () => {
    if (userId) {
      await loadScheduledServices(userId)
    }
  }, [userId, loadScheduledServices])

  const refreshAll = useCallback(async () => {
    if (userId) {
      await loadAllForUser(userId)
    }
  }, [userId, loadAllForUser])

  // Optimistic update functions
  const addVehicleOptimistic = useCallback(
    async (vehicleData: Omit<Vehicle, "id" | "created_at" | "updated_at">) => {
      if (!userId) return

      // Create optimistic vehicle
      const optimisticVehicle: Vehicle = {
        id: `temp-${Date.now()}`,
        ...vehicleData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Add optimistically
      setVehicles((prev) => prependOptimistic(prev, optimisticVehicle))

      try {
        const { data, error } = await supabase
          .from("vehicles")
          .insert({ ...vehicleData, user_id: userId })
          .select()
          .single()

        if (error) throw error

        // Replace optimistic with real data
        setVehicles((prev) => replaceOptimistic(prev, optimisticVehicle.id, data))
      } catch (error) {
        // Revert optimistic update
        setVehicles((prev) => removeOptimistic(prev, optimisticVehicle.id))
        throw error
      }
    },
    [userId, supabase]
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
      setVehicles((prev) => removeOptimistic(prev, id))

      try {
        const { error } = await supabase.from("vehicles").delete().eq("id", id)

        if (error) throw error
      } catch (error) {
        // Revert optimistic update
        if (vehicleToDelete) {
          setVehicles((prev) => prependOptimistic(prev, vehicleToDelete))
        }
        throw error
      }
    },
    [vehicles, supabase]
  )

  // A receipt confirms the transaction; refreshing never changes a confirmed write
  // into a failed write. This context owns all related projection refreshes.
  const acceptMaintenanceReceipt = useCallback(
    async (receipt: MaintenanceReceipt) => {
      setMaintenanceRecords((prev) => [
        ...receipt.records,
        ...prev.filter((row) => !receipt.records.some((saved) => saved.id === row.id)),
      ])
      setVehicles((prev) =>
        prev.map((vehicle) =>
          vehicle.id === receipt.vehicle.id
            ? {
                ...vehicle,
                mileage:
                  receipt.vehicle.mileage === null
                    ? vehicle.mileage
                    : Math.max(vehicle.mileage ?? 0, receipt.vehicle.mileage),
              }
            : vehicle
        )
      )
      if (receipt.scheduled_service)
        setScheduledServices((prev) => prev.filter((service) => service.id !== receipt.scheduled_service?.id))
      await Promise.all([refreshMaintenance(), refreshVehicles(), refreshScheduledServices()])
    },
    [refreshMaintenance, refreshVehicles, refreshScheduledServices]
  )

  const reconcileMaintenanceBatch = useCallback(
    async (command: MaintenanceCommand): Promise<MaintenanceBatchResult> => {
      if (!userId) return { status: "rejected" }
      try {
        const { data, error } = await supabase
          .rpc("get_maintenance_batch_operation", { p_operation_id: command.operationId })
          .abortSignal(AbortSignal.timeout(15000))
        const receipt = !error && readMaintenanceReceipt(data, command, userId)
        if (receipt) {
          await acceptMaintenanceReceipt(receipt)
          return { status: "success" }
        }
      } catch {
        /* A failed lookup cannot prove rollback. Keep the operation identity. */
      }
      return { status: "unknown" }
    },
    [userId, supabase, acceptMaintenanceReceipt]
  )

  const createMaintenanceBatch = useCallback(
    async (input: MaintenanceCommand): Promise<MaintenanceBatchResult> => {
      if (!userId) return { status: "rejected" }
      const command = maintenanceCommandSchema.parse(input)
      try {
        const { data, error } = await supabase
          .rpc("create_maintenance_batch", maintenanceRpcArgs(command))
          .abortSignal(AbortSignal.timeout(15000))
        const receipt = !error && readMaintenanceReceipt(data, command, userId)
        if (receipt) {
          await acceptMaintenanceReceipt(receipt)
          return { status: "success" }
        }
        // These PostgreSQL errors are definitive transaction rejection. Transport
        // failures and unexpected responses must be reconciled, never called rollback.
        if (error && /^(22|23|42501|P0001|PGRST20[23])/.test(error.code)) return { status: "rejected" }
      } catch {
        /* Transport cancellation says nothing about database commit. */
      }
      return reconcileMaintenanceBatch(command)
    },
    [userId, supabase, acceptMaintenanceReceipt, reconcileMaintenanceBatch]
  )

  const addMaintenanceOptimistic = useCallback(
    async (recordData: Omit<MaintenanceRecord, "id" | "created_at" | "updated_at">) => {
      const command = maintenanceCommandSchema.parse({
        operationId: crypto.randomUUID(),
        vehicleId: recordData.vehicle_id,
        today: localToday(),
        batch: { ...recordData, services: [recordData] },
      })
      const result = await createMaintenanceBatch(command)
      if (result.status !== "success")
        throw new Error(
          result.status === "unknown"
            ? "Resultado de mantenimiento pendiente de confirmar"
            : "No se pudo guardar el mantenimiento"
        )
    },
    [createMaintenanceBatch]
  )

  const updateMaintenanceOptimistic = useCallback(
    async (id: string, updates: TablesUpdate<"maintenance_records">) => {
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

      setMaintenanceRecords((prev) => removeOptimistic(prev, id))

      try {
        const { error } = await supabase.from("maintenance_records").delete().eq("id", id)

        if (error) throw error
      } catch (error) {
        if (recordToDelete) {
          setMaintenanceRecords((prev) => prependOptimistic(prev, recordToDelete))
        }
        throw error
      }
    },
    [maintenanceRecords, supabase]
  )

  const addScheduledServiceOptimistic = useCallback(
    async (serviceData: Omit<ScheduledService, "id" | "created_at" | "updated_at" | "vehicles">) => {
      if (!userId) return

      const optimisticService: ScheduledService = {
        id: `temp-${Date.now()}`,
        ...serviceData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setScheduledServices((prev) => prependOptimistic(prev, optimisticService))

      try {
        const { data, error } = await supabase
          .from("scheduled_services")
          .insert({ ...serviceData, user_id: userId })
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

        setScheduledServices((prev) => replaceOptimistic(prev, optimisticService.id, data as ScheduledService))
      } catch (error) {
        setScheduledServices((prev) => removeOptimistic(prev, optimisticService.id))
        throw error
      }
    },
    [userId, supabase]
  )

  const updateScheduledServiceOptimistic = useCallback(
    async (id: string, updates: TablesUpdate<"scheduled_services"> & { status?: ScheduledServiceStatus }) => {
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

      setScheduledServices((prev) => removeOptimistic(prev, id))

      try {
        const { error } = await supabase.from("scheduled_services").delete().eq("id", id)

        if (error) throw error
      } catch (error) {
        if (serviceToDelete) {
          setScheduledServices((prev) => prependOptimistic(prev, serviceToDelete))
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
            ? {
                ...s,
                status: "completed" as ScheduledServiceStatus,
                completed_record_id: completedRecordId,
                updated_at: new Date().toISOString(),
              }
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
    const transition = resolveDataAuthTransition(authState, hasLoadedRef.current)

    if (transition.type === "load") {
      hasLoadedRef.current = true
      void loadAllForUser(transition.userId)
    } else if (transition.type === "clear") {
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
  }, [authState.status, userId])

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
    createMaintenanceBatch,
    reconcileMaintenanceBatch,
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
