"use client"

/* eslint-disable react/jsx-no-constructed-context-values -- The provider publishes a single interactive projection. */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { readPendingCommands, writePendingCommands } from "@/lib/data/pending-operations"
import {
  readDataSnapshot,
  maintenanceHistoryQuery,
  readMaintenanceTotals,
  HISTORY_PAGE_SIZE,
  type HistoryCursor,
  type MaintenanceTotals,
} from "@/lib/data/queries"
import { useAuthProjection } from "./AuthProjectionContext"
import { useSupabase } from "./SupabaseContext"
import { AUTH_STATE_STATUS } from "@/lib/auth/contracts"
import type { Tables } from "@/lib/supabase/database.types"
import type { ScheduledServiceValues } from "@/lib/data/scheduled-command"
import {
  isConfirmedRejection,
  type VehicleValues,
  type MaintenanceValues,
  dataCommandSchema,
  executeDataCommand,
  queryDataOperation,
  type DataCommand,
  type DataReceipt,
} from "@/lib/data/data-command"
import {
  maintenanceCommandSchema,
  maintenanceRpcArgs,
  readMaintenanceReceipt,
  type MaintenanceCommand,
  type MaintenanceBatchResult,
  type MaintenanceReceipt,
} from "@/lib/data/maintenance-command"

type VehicleRow = Tables<"vehicles">
export type Vehicle = Omit<VehicleRow, "user_id">
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
    vehicles?: Pick<VehicleRow, "make" | "model" | "year" | "license_plate" | "mileage">
  }

export type PendingDataOperation = { command: DataCommand; status: "sending" | "unknown" | "checking" }

interface DataContextType {
  totals: MaintenanceTotals | null
  history: {
    vehicleId: string
    records: MaintenanceRecord[]
    totals: MaintenanceTotals
    page: number
    hasNext: boolean
  } | null
  selectHistory: (vehicleId?: string) => void
  changeHistoryPage: (direction: "next" | "previous") => void
  operationStorageError: boolean
  pendingOperations: PendingDataOperation[]
  reconcileDataOperation: (operationId: string) => Promise<void>
  // Data
  vehicles: Vehicle[]
  maintenanceRecords: MaintenanceRecord[]
  scheduledServices: ScheduledService[]

  hasLoaded: boolean
  loadError: string | null
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
  addVehicleOptimistic: (vehicle: VehicleValues) => Promise<void>
  updateVehicleOptimistic: (id: string, updates: VehicleValues) => Promise<void>
  deleteVehicleOptimistic: (id: string) => Promise<void>

  createMaintenanceBatch: (command: MaintenanceCommand) => Promise<MaintenanceBatchResult>
  reconcileMaintenanceBatch: (command: MaintenanceCommand) => Promise<MaintenanceBatchResult>

  // Optimistic updates - Maintenance
  updateMaintenanceOptimistic: (id: string, updates: MaintenanceValues) => Promise<void>
  deleteMaintenanceOptimistic: (id: string) => Promise<void>

  addScheduledServiceOptimistic: (vehicleId: string, values: ScheduledServiceValues) => Promise<void>
  updateScheduledServiceOptimistic: (id: string, values: ScheduledServiceValues) => Promise<void>
  cancelScheduledService: (id: string) => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

interface DataProviderProps {
  children: React.ReactNode
}

export function DataProvider({ children }: DataProviderProps) {
  const authState = useAuthProjection()
  const userId = authState.status === AUTH_STATE_STATUS.AUTHENTICATED ? authState.user.id : null
  const [totals, setTotals] = useState<MaintenanceTotals | null>(null)
  const [history, setHistory] = useState<DataContextType["history"]>(null)
  const historyRequest = React.useRef<{ vehicleId: string; cursors: (HistoryCursor | undefined)[] } | null>(null)
  const committedHistoryRequest = React.useRef<typeof historyRequest.current>(null)
  const [dataOwner, setDataOwner] = useState(userId)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([])
  const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([])

  const [isVehiclesLoading, setIsVehiclesLoading] = useState(true)
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(true)
  const [isScheduledServicesLoading, setIsScheduledServicesLoading] = useState(true)

  const supabase = useSupabase()
  const [pendingOperations, setPendingOperations] = useState<PendingDataOperation[]>([])
  const deletedVehicles = React.useRef(new Set<string>())
  const [operationStorageError, setOperationStorageError] = useState(false)
  const pendingRef = React.useRef<PendingDataOperation[]>([])

  const [hasLoaded, setHasLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const scope = React.useRef({ userId, generation: 0, revision: 0, request: 0 })
  if (scope.current.userId !== userId) {
    scope.current = { userId, generation: scope.current.generation + 1, revision: 0, request: 0 }
  }
  const loadAllForUser = useCallback(
    async (currentUserId: string) => {
      if (scope.current.userId !== currentUserId) return
      const owner = scope.current
      const request = ++owner.request
      const revision = owner.revision
      setIsVehiclesLoading(true)
      setIsMaintenanceLoading(true)
      setIsScheduledServicesLoading(true)
      try {
        const requestedHistory = historyRequest.current
        const [snapshot, historyResult] = await Promise.all([
          readDataSnapshot(supabase, currentUserId),
          requestedHistory
            ? Promise.all([
                maintenanceHistoryQuery(
                  supabase,
                  currentUserId,
                  requestedHistory.vehicleId,
                  requestedHistory.cursors.at(-1),
                  HISTORY_PAGE_SIZE + 1
                )
                  .abortSignal(AbortSignal.timeout(15000))
                  .retry(false),
                readMaintenanceTotals(supabase, requestedHistory.vehicleId),
              ])
            : null,
        ])
        if (historyResult?.[0].error || (historyResult && !historyResult[0].data))
          throw new Error("History unavailable")
        if (scope.current !== owner || request !== owner.request || revision !== owner.revision) return
        committedHistoryRequest.current = requestedHistory
        setTotals(snapshot.totals)
        if (requestedHistory && historyResult)
          setHistory({
            vehicleId: requestedHistory.vehicleId,
            records: (historyResult[0].data ?? []).slice(0, HISTORY_PAGE_SIZE),
            totals: historyResult[1],
            page: requestedHistory.cursors.length,
            hasNext: (historyResult[0].data ?? []).length > HISTORY_PAGE_SIZE,
          })
        else setHistory(null)
        setVehicles(snapshot.vehicles)
        setMaintenanceRecords(snapshot.maintenanceRecords)
        setScheduledServices(snapshot.scheduledServices as ScheduledService[])
        setHasLoaded(true)
        setLoadError(null)
      } catch {
        if (scope.current === owner && request === owner.request)
          setLoadError("No se pudieron cargar los datos. Se conservan los últimos datos válidos.")
      } finally {
        if (scope.current === owner && request === owner.request) {
          setIsVehiclesLoading(false)
          setIsMaintenanceLoading(false)
          setIsScheduledServicesLoading(false)
        }
      }
    },
    [supabase]
  )
  const refreshAll = useCallback(async () => {
    if (userId) await loadAllForUser(userId)
  }, [userId, loadAllForUser])
  const selectHistory = useCallback(
    (vehicleId?: string) => {
      if (historyRequest.current?.vehicleId === vehicleId) return
      historyRequest.current = vehicleId ? { vehicleId, cursors: [undefined] } : null
      setHistory(null)
      if (userId) void loadAllForUser(userId)
    },
    [userId, loadAllForUser]
  )
  const changeHistoryPage = useCallback(
    (direction: "next" | "previous") => {
      if (!history || !userId) return
      const cursors = committedHistoryRequest.current?.cursors.slice(0, history.page) ?? [undefined]
      if (direction === "next") {
        if (!history.hasNext) return
        cursors.push(history.records.at(-1))
      } else {
        if (history.page <= 1) return
        cursors.pop()
      }
      historyRequest.current = { vehicleId: history.vehicleId, cursors }
      void loadAllForUser(userId)
    },
    [history, userId, loadAllForUser]
  )
  const invalidateHistory = useCallback(() => {
    setTotals(null)
    setHistory(null)
    if (historyRequest.current)
      historyRequest.current = { vehicleId: historyRequest.current.vehicleId, cursors: [undefined] }
  }, [])
  const refreshVehicles = refreshAll
  const refreshMaintenance = refreshAll
  const refreshScheduledServices = refreshAll

  const publishPending = useCallback(
    (operations: PendingDataOperation[]) => {
      pendingRef.current = operations
      setPendingOperations(operations)
      if (userId)
        setOperationStorageError(
          !writePendingCommands(
            userId,
            operations.map((operation) => operation.command)
          )
        )
    },
    [userId]
  )

  const acceptDataReceipt = useCallback(
    (receipt: DataReceipt) => {
      scope.current.revision++
      invalidateHistory()
      if ("vehicle_id" in receipt.row && deletedVehicles.current.has(receipt.row.vehicle_id)) return
      const id = receipt.row.id
      if (receipt.action.startsWith("vehicle.")) {
        if (receipt.action === "vehicle.delete") {
          deletedVehicles.current.add(id)
          setVehicles((prev) => prev.filter((row) => row.id !== id))
          setMaintenanceRecords((prev) => prev.filter((row) => row.vehicle_id !== id))
          setScheduledServices((prev) => prev.filter((row) => row.vehicle_id !== id))
        } else {
          const row = receipt.row as VehicleRow
          setVehicles((prev) => {
            const current = prev.find((value) => value.id === id)
            if (current?.updated_at && row.updated_at && current.updated_at > row.updated_at) return prev
            return [row, ...prev.filter((value) => value.id !== id)]
          })
        }
      } else if (receipt.action.startsWith("maintenance.")) {
        const row = receipt.row as Tables<"maintenance_records">
        setMaintenanceRecords((prev) =>
          receipt.action === "maintenance.delete"
            ? prev.filter((value) => value.id !== id)
            : prev.map((value) => (value.id === id ? row : value))
        )
      } else {
        const row = receipt.row as ScheduledService
        setScheduledServices((prev) =>
          row.status === "pending"
            ? [row, ...prev.filter((value) => value.id !== id)]
            : prev.filter((value) => value.id !== id)
        )
      }
    },
    [invalidateHistory]
  )

  const reconcileDataOperation = useCallback(
    async (operationId: string) => {
      const operation = pendingRef.current.find((value) => value.command.operationId === operationId)
      if (!operation || operation.status !== "unknown" || !userId) return
      const owner = scope.current
      publishPending(
        pendingRef.current.map((value) => (value === operation ? { ...value, status: "checking" } : value))
      )
      const outcome = await queryDataOperation(supabase, userId, operation.command)
      if (scope.current !== owner) return
      if (outcome.status === "success") {
        acceptDataReceipt(outcome.receipt)
        publishPending(pendingRef.current.filter((value) => value.command.operationId !== operationId))
        void refreshAll()
      } else
        publishPending(
          pendingRef.current.map((value) =>
            value.command.operationId === operationId ? { ...value, status: "unknown" } : value
          )
        )
    },
    [userId, supabase, publishPending, acceptDataReceipt, refreshAll]
  )

  const mutate = useCallback(
    async (action: DataCommand["action"], id: string, values: unknown) => {
      if (!userId || scope.current.userId !== userId) throw new Error("No hay sesión activa")
      if (
        pendingRef.current.some(
          (operation) =>
            operation.command.id === id || (operation.command.action === action && action.endsWith(".create"))
        )
      )
        throw new Error("Resultado pendiente de confirmar. Comprueba la operación anterior antes de continuar.")
      const command = dataCommandSchema.parse({ operationId: crypto.randomUUID(), action, id, values })
      Object.freeze(command.values)
      Object.freeze(command)
      // Parsed payload is copied and retained; no caller may change or resend it.
      const owner = scope.current
      owner.revision++
      publishPending([...pendingRef.current, { command, status: "sending" }])
      const outcome = await executeDataCommand(supabase, userId, command)
      if (scope.current !== owner) throw new Error("La sesión ha cambiado. No se aplicó una respuesta anterior.")
      if (outcome.status === "unknown") {
        publishPending(
          pendingRef.current.map((value) =>
            value.command.operationId === command.operationId ? { ...value, status: "unknown" } : value
          )
        )
        throw new Error("Resultado pendiente de confirmar. No repitas la operación; utiliza Comprobar resultado.")
      }
      publishPending(pendingRef.current.filter((value) => value.command.operationId !== command.operationId))
      if (outcome.status === "rejected") {
        void refreshAll()
        throw new Error(
          "No se realizó la operación. No se confirmó ninguna fila; revisa los datos y vuelve a intentarlo."
        )
      }
      acceptDataReceipt(outcome.receipt)
      void refreshAll()
    },
    [userId, supabase, publishPending, acceptDataReceipt, refreshAll]
  )

  const addVehicleOptimistic = useCallback(
    async (values: VehicleValues) => {
      await mutate("vehicle.create", crypto.randomUUID(), values)
    },
    [mutate]
  )
  const updateVehicleOptimistic = useCallback(
    async (id: string, values: VehicleValues) => {
      await mutate("vehicle.update", id, values)
    },
    [mutate]
  )
  const deleteVehicleOptimistic = useCallback(
    async (id: string) => {
      await mutate("vehicle.delete", id, {})
    },
    [mutate]
  )

  // A receipt confirms the transaction; refreshing never changes a confirmed write
  // into a failed write. This context owns all related projection refreshes.
  const acceptMaintenanceReceipt = useCallback(
    async (receipt: MaintenanceReceipt) => {
      scope.current.revision++
      invalidateHistory()
      if (deletedVehicles.current.has(receipt.vehicle.id)) return
      setMaintenanceRecords((prev) =>
        [
          ...receipt.records.map((record) => ({ ...record, vehicles: receipt.vehicle })),
          ...prev.filter((row) => !receipt.records.some((saved) => saved.id === row.id)),
        ]
          .toSorted((a, b) => b.service_date.localeCompare(a.service_date) || b.id.localeCompare(a.id))
          .slice(0, 5)
      )
      setVehicles((prev) =>
        prev.map((vehicle) =>
          vehicle.id === receipt.vehicle.id
            ? {
                ...vehicle,
                updated_at:
                  receipt.vehicle.updated_at && (!vehicle.updated_at || receipt.vehicle.updated_at > vehicle.updated_at)
                    ? receipt.vehicle.updated_at
                    : vehicle.updated_at,
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
      void refreshAll()
    },
    [refreshAll, invalidateHistory]
  )

  const reconcileMaintenanceBatch = useCallback(
    async (command: MaintenanceCommand): Promise<MaintenanceBatchResult> => {
      if (!userId || scope.current.userId !== userId) return { status: "rejected" }
      const owner = scope.current
      try {
        const { data, error } = await supabase
          .rpc("get_maintenance_batch_operation", { p_operation_id: command.operationId })
          .abortSignal(AbortSignal.timeout(15000))
          .retry(false)
        if (scope.current !== owner) return { status: "unknown" }
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
      if (!userId || scope.current.userId !== userId) return { status: "rejected" }
      const command = maintenanceCommandSchema.parse(input)
      const owner = scope.current
      owner.revision++
      try {
        const { data, error } = await supabase
          .rpc("create_maintenance_batch", maintenanceRpcArgs(command))
          .abortSignal(AbortSignal.timeout(15000))
          .retry(false)
        if (scope.current !== owner) return { status: "unknown" }
        const receipt = !error && readMaintenanceReceipt(data, command, userId)
        if (receipt) {
          await acceptMaintenanceReceipt(receipt)
          return { status: "success" }
        }
        // These PostgreSQL errors are definitive transaction rejection. Transport
        // failures and unexpected responses must be reconciled, never called rollback.
        if (isConfirmedRejection(error)) return { status: "rejected" }
      } catch {
        /* Transport cancellation says nothing about database commit. */
      }
      return reconcileMaintenanceBatch(command)
    },
    [userId, supabase, acceptMaintenanceReceipt, reconcileMaintenanceBatch]
  )

  const updateMaintenanceOptimistic = useCallback(
    async (id: string, values: MaintenanceValues) => {
      await mutate("maintenance.update", id, values)
    },
    [mutate]
  )
  const deleteMaintenanceOptimistic = useCallback(
    async (id: string) => {
      await mutate("maintenance.delete", id, {})
    },
    [mutate]
  )
  const addScheduledServiceOptimistic = useCallback(
    async (vehicleId: string, values: ScheduledServiceValues) => {
      await mutate("schedule.create", crypto.randomUUID(), { ...values, vehicle_id: vehicleId })
    },
    [mutate]
  )
  const updateScheduledServiceOptimistic = useCallback(
    async (id: string, values: ScheduledServiceValues) => {
      await mutate("schedule.update", id, values)
    },
    [mutate]
  )
  const cancelSchedule = useCallback(
    async (id: string) => {
      await mutate("schedule.cancel", id, {})
    },
    [mutate]
  )

  useEffect(() => {
    deletedVehicles.current.clear()
    setDataOwner(userId)
    pendingRef.current = userId
      ? readPendingCommands(userId).map((command) => ({ command, status: "unknown" as const }))
      : []
    setPendingOperations(pendingRef.current)
    setOperationStorageError(false)
    setTotals(null)
    setHistory(null)
    if (historyRequest.current)
      historyRequest.current = { vehicleId: historyRequest.current.vehicleId, cursors: [undefined] }
    setVehicles([])
    setMaintenanceRecords([])
    setScheduledServices([])
    setHasLoaded(false)
    setLoadError(null)
    if (userId) void loadAllForUser(userId)
    else {
      setIsVehiclesLoading(false)
      setIsMaintenanceLoading(false)
      setIsScheduledServicesLoading(false)
    }
  }, [userId, loadAllForUser, publishPending])

  let visibleVehicles = vehicles
  let visibleRecords = maintenanceRecords
  let visibleSchedules = scheduledServices
  for (const { command } of pendingOperations) {
    const { id, action, values } = command
    if (action === "vehicle.create")
      visibleVehicles = visibleVehicles.some((row) => row.id === id)
        ? visibleVehicles
        : [{ ...values, id, created_at: null, updated_at: null }, ...visibleVehicles]
    if (action === "vehicle.update")
      visibleVehicles = visibleVehicles.map((row) => (row.id === id ? { ...row, ...values } : row))
    if (action === "vehicle.delete") {
      visibleVehicles = visibleVehicles.filter((row) => row.id !== id)
      visibleRecords = visibleRecords.filter((row) => row.vehicle_id !== id)
      visibleSchedules = visibleSchedules.filter((row) => row.vehicle_id !== id)
    }
    if (action === "schedule.update")
      visibleSchedules = visibleSchedules.map((row) => (row.id === id ? { ...row, ...values } : row))
    // Cancellation stays visible until confirmed so its recovery action remains reachable.
  }
  const vehicleById = new Map(visibleVehicles.map((vehicle) => [vehicle.id, vehicle]))
  visibleRecords = visibleRecords.map((row) => ({
    ...row,
    vehicles: vehicleById.get(row.vehicle_id) ?? row.vehicles,
  }))
  visibleSchedules = visibleSchedules.map((row) => ({
    ...row,
    vehicles: vehicleById.get(row.vehicle_id) ?? row.vehicles,
  }))

  const value: DataContextType = {
    totals: dataOwner === userId ? totals : null,
    history: dataOwner === userId ? history : null,
    selectHistory,
    changeHistoryPage,
    operationStorageError: dataOwner === userId && operationStorageError,
    pendingOperations: dataOwner === userId ? pendingOperations : [],
    reconcileDataOperation,
    hasLoaded: dataOwner === userId && hasLoaded,
    loadError: dataOwner === userId ? loadError : null,
    // Data
    vehicles: dataOwner === userId ? visibleVehicles : [],
    maintenanceRecords: dataOwner === userId ? visibleRecords : [],
    scheduledServices: dataOwner === userId ? visibleSchedules : [],

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
    updateMaintenanceOptimistic,
    deleteMaintenanceOptimistic,

    // Optimistic updates - Scheduled Services
    addScheduledServiceOptimistic,
    updateScheduledServiceOptimistic,
    cancelScheduledService: cancelSchedule,
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
