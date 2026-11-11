"use client"

/* eslint-disable react/jsx-no-constructed-context-values -- The provider publishes a single interactive projection. */

import React, { createContext, useContext, useEffect, useReducer, useState, useCallback } from "react"
import { readPendingCommands, writePendingCommands, freezePendingCommand } from "@/lib/data/pending-operations"
import {
  readDataSnapshot,
  maintenanceHistoryQuery,
  readMaintenanceTotals,
  HISTORY_PAGE_SIZE,
  type MaintenanceTotals,
} from "@/lib/data/queries"
import {
  INITIAL_SNAPSHOT_STATE,
  historyRequest as requestedHistoryOf,
  requestFreshness,
  snapshotIsFetching,
  transitionHistory,
  transitionSnapshot,
  type HistoryEvent,
  type HistoryState,
  type SnapshotState,
  type SnapshotStatus,
} from "@/lib/data/snapshot-machine"
import { snapshotLoadError } from "@/lib/data/snapshot-messages"
import { useAuthProjection } from "./AuthProjectionContext"
import { useSupabase } from "./SupabaseContext"
import { AUTH_STATE_STATUS } from "@/lib/auth/contracts"
import type { Tables } from "@/lib/supabase/database.types"
import type { ScheduledServiceValues } from "@/lib/data/scheduled-command"
import { isPendingScheduledService, type ScheduledServiceStatus } from "@/lib/data/scheduled-service-lifecycle"
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
  type MaintenanceReceipt,
} from "@/lib/data/maintenance-command"
import {
  OPERATION_POLICY,
  conflictsWith,
  isTerminalStatus,
  operationKind,
  transitionJournal,
  transitionOperation,
  type JournalEvent,
  type JournalHealth,
  type OperationEvent,
  type OperationOutcome,
  type PendingOperation,
} from "@/lib/data/operation-machine"

type VehicleRow = Tables<"vehicles">
export type Vehicle = Omit<VehicleRow, "user_id">
export type MaintenanceRecord = Tables<"maintenance_records"> & {
  vehicles?: Pick<VehicleRow, "make" | "model" | "year">
}
export type { ScheduledServiceStatus }
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

export type PendingDataOperation = PendingOperation

type MaintenanceHistoryState = HistoryState<MaintenanceRecord, MaintenanceTotals>
type MaintenanceHistoryEvent = HistoryEvent<MaintenanceRecord, MaintenanceTotals>

/** Fields that belong to the account whose data the provider currently holds. */
type OwnedData = Pick<
  DataContextType,
  | "snapshot"
  | "history"
  | "totals"
  | "journal"
  | "pendingOperations"
  | "vehicles"
  | "maintenanceRecords"
  | "scheduledServices"
>

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
  journal: JournalHealth
  /** Derived: the journal is not healthy. */
  operationStorageError: boolean
  pendingOperations: PendingDataOperation[]
  reconcileDataOperation: (operationId: string) => Promise<OperationOutcome>
  /** Explicitly resend an unresolved CRUD command's retained frozen payload with its operation id (D2). */
  replayDataOperation: (operationId: string) => Promise<OperationOutcome>
  // Data
  vehicles: Vehicle[]
  maintenanceRecords: MaintenanceRecord[]
  scheduledServices: ScheduledService[]

  snapshot: SnapshotState
  snapshotStatus: SnapshotStatus
  // Legacy projections of `snapshot`, kept until every consumer reads the machine.
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

  // Mutations are pessimistic writes; pending commands are overlaid at render time.
  createVehicle: (vehicle: VehicleValues) => Promise<OperationOutcome>
  updateVehicle: (id: string, updates: VehicleValues) => Promise<OperationOutcome>
  deleteVehicle: (id: string) => Promise<OperationOutcome>

  createMaintenanceBatch: (command: MaintenanceCommand) => Promise<OperationOutcome>
  reconcileMaintenanceBatch: (command: MaintenanceCommand) => Promise<OperationOutcome>

  updateMaintenance: (id: string, updates: MaintenanceValues) => Promise<OperationOutcome>
  deleteMaintenance: (id: string) => Promise<OperationOutcome>

  createScheduledService: (vehicleId: string, values: ScheduledServiceValues) => Promise<OperationOutcome>
  updateScheduledService: (id: string, values: ScheduledServiceValues) => Promise<OperationOutcome>
  cancelScheduledService: (id: string) => Promise<OperationOutcome>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

interface DataProviderProps {
  children: React.ReactNode
}

export function DataProvider({ children }: DataProviderProps) {
  const authState = useAuthProjection()
  const userId = authState.status === AUTH_STATE_STATUS.AUTHENTICATED ? authState.user.id : null
  const [totals, setTotals] = useState<MaintenanceTotals | null>(null)
  const [history, setHistory] = useState<MaintenanceHistoryState>({ status: "none" })
  // Mirrors `history` synchronously so a load reads the latest request when it starts.
  const historyRef = React.useRef<MaintenanceHistoryState>(history)
  const [dataOwner, setDataOwner] = useState(userId)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([])
  const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([])
  const [snapshotState, dispatchSnapshot] = useReducer(transitionSnapshot, INITIAL_SNAPSHOT_STATE)

  const supabase = useSupabase()
  const [pendingOperations, setPendingOperations] = useState<PendingDataOperation[]>([])
  const deletedVehicles = React.useRef(new Set<string>())
  const pendingRef = React.useRef<PendingDataOperation[]>([])
  const [journal, setJournal] = useState<JournalHealth>("healthy")
  const journalRef = React.useRef<JournalHealth>("healthy")
  const recordJournal = useCallback((event: JournalEvent) => {
    journalRef.current = transitionJournal(journalRef.current, event)
    setJournal(journalRef.current)
  }, [])

  const scope = React.useRef({ userId, generation: 0, revision: 0, request: 0 })
  if (scope.current.userId !== userId) {
    scope.current = { userId, generation: scope.current.generation + 1, revision: 0, request: 0 }
  }
  const updateHistory = useCallback((event: MaintenanceHistoryEvent) => {
    const next = transitionHistory(historyRef.current, event)
    historyRef.current = next
    setHistory(next)
    return next
  }, [])
  const loadAllForUser = useCallback(
    async (currentUserId: string) => {
      if (scope.current.userId !== currentUserId) return
      const owner = scope.current
      const token = { generation: owner.generation, request: ++owner.request, revision: owner.revision }
      dispatchSnapshot({ type: "LOAD_STARTED" })
      try {
        const requestedHistory = requestedHistoryOf(historyRef.current)
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
        const freshness = requestFreshness(scope.current, token)
        if (freshness !== "current") {
          dispatchSnapshot({ type: "LOAD_SUCCEEDED", freshness })
          return
        }
        setTotals(snapshot.totals)
        const historyRows = historyResult?.[0].data ?? []
        updateHistory({
          type: "LOADED",
          request: requestedHistory,
          result: historyResult
            ? {
                records: historyRows.slice(0, HISTORY_PAGE_SIZE),
                totals: historyResult[1],
                hasNext: historyRows.length > HISTORY_PAGE_SIZE,
              }
            : null,
        })
        setVehicles(snapshot.vehicles)
        setMaintenanceRecords(snapshot.maintenanceRecords)
        setScheduledServices(snapshot.scheduledServices as ScheduledService[])
        dispatchSnapshot({ type: "LOAD_SUCCEEDED", freshness })
      } catch {
        dispatchSnapshot({ type: "LOAD_FAILED", freshness: requestFreshness(scope.current, token) })
      }
    },
    [supabase, updateHistory]
  )
  const refreshAll = useCallback(async () => {
    if (userId) await loadAllForUser(userId)
  }, [userId, loadAllForUser])
  const selectHistory = useCallback(
    (vehicleId?: string) => {
      const current = historyRef.current
      if (updateHistory({ type: "SELECT", vehicleId }) === current) return
      if (userId) void loadAllForUser(userId)
    },
    [userId, loadAllForUser, updateHistory]
  )
  const changeHistoryPage = useCallback(
    (direction: "next" | "previous") => {
      if (!userId) return
      const current = historyRef.current
      if (updateHistory({ type: "PAGE", direction }) === current) return
      void loadAllForUser(userId)
    },
    [userId, loadAllForUser, updateHistory]
  )
  const invalidateHistory = useCallback(() => {
    setTotals(null)
    updateHistory({ type: "INVALIDATE" })
  }, [updateHistory])
  const refreshVehicles = refreshAll
  const refreshMaintenance = refreshAll
  const refreshScheduledServices = refreshAll

  const publishPending = useCallback(
    (operations: PendingDataOperation[]) => {
      pendingRef.current = operations
      setPendingOperations(operations)
      const stored =
        journalRef.current !== "unreadable" &&
        !!userId &&
        writePendingCommands(
          userId,
          operations.map((operation) => operation.command)
        )
      recordJournal({ type: stored ? "WRITTEN" : "WRITE_FAILED" })
      return stored
    },
    [userId, recordJournal]
  )

  /** Apply one lifecycle event; terminal operations leave the pending list and the journal. */
  const advanceOperation = useCallback(
    (operationId: string, event: OperationEvent) =>
      publishPending(
        pendingRef.current.flatMap((operation) => {
          if (operation.command.operationId !== operationId) return [operation]
          const status = transitionOperation(operation.status, event)
          return isTerminalStatus(status) ? [] : [{ ...operation, status }]
        })
      ),
    [publishPending]
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
          isPendingScheduledService(row.status)
            ? [row, ...prev.filter((value) => value.id !== id)]
            : prev.filter((value) => value.id !== id)
        )
      }
    },
    [invalidateHistory]
  )

  const reconcileDataOperation = useCallback(
    async (operationId: string): Promise<OperationOutcome> => {
      if (!userId) return { status: "blocked", reason: "no-session" }
      const operation = pendingRef.current.find((value) => value.command.operationId === operationId)
      if (!operation || operation.command.action === "maintenance.batch" || operation.status !== "unknown")
        return { status: "unknown", operationId }
      const owner = scope.current
      advanceOperation(operationId, { type: "CHECK" })
      const outcome = await queryDataOperation(supabase, userId, operation.command)
      if (scope.current !== owner) return { status: "blocked", reason: "session-changed" }
      if (outcome.status === "success") {
        acceptDataReceipt(outcome.receipt)
        advanceOperation(operationId, { type: "RECEIPT" })
        void refreshAll()
        return { status: "confirmed" }
      }
      advanceOperation(operationId, { type: "NO_PROOF" })
      return { status: "unknown", operationId }
    },
    [userId, supabase, advanceOperation, acceptDataReceipt, refreshAll]
  )

  // CRUD policy (OPERATION_POLICY.crud): sends even if the journal write fails and is never checked
  // or resent automatically. `unknown` is resolved by an explicit status query or an explicit
  // replay of the same frozen command; `mutate_data` is idempotent per operation id (D2).
  /** Send a command already listed as `sending`; a replay handles its outcome as a first send. */
  const sendDataCommand = useCallback(
    async (accountId: string, command: DataCommand): Promise<OperationOutcome> => {
      const { operationId } = command
      const owner = scope.current
      owner.revision++
      const outcome = await executeDataCommand(supabase, accountId, command)
      if (scope.current !== owner) return { status: "blocked", reason: "session-changed" }
      if (outcome.status === "unknown") {
        advanceOperation(operationId, { type: "NO_PROOF" })
        return { status: "unknown", operationId }
      }
      advanceOperation(operationId, { type: outcome.status === "rejected" ? "REJECTED" : "RECEIPT" })
      if (outcome.status === "rejected") {
        void refreshAll()
        return { status: "rejected" }
      }
      acceptDataReceipt(outcome.receipt)
      void refreshAll()
      return { status: "confirmed" }
    },
    [supabase, advanceOperation, acceptDataReceipt, refreshAll]
  )

  const mutate = useCallback(
    async (action: DataCommand["action"], id: string, values: unknown): Promise<OperationOutcome> => {
      if (!userId || scope.current.userId !== userId) return { status: "blocked", reason: "no-session" }
      if (journalRef.current === "unreadable") return { status: "blocked", reason: "journal-unreadable" }
      const operationId = crypto.randomUUID()
      if (pendingRef.current.some((operation) => conflictsWith(operation, { action, id, operationId })))
        return { status: "blocked", reason: "conflict" }
      const parsed = dataCommandSchema.safeParse({ operationId, action, id, values })
      if (!parsed.success) return { status: "rejected" }
      const command = parsed.data
      Object.freeze(command.values)
      Object.freeze(command)
      // Parsed payload is copied and retained; no caller may change it. Only an explicit
      // replay (`replayDataOperation`) resends it, with the same operation id.
      publishPending([...pendingRef.current, { command, status: "sending" }])
      return sendDataCommand(userId, command)
    },
    [userId, publishPending, sendDataCommand]
  )

  const replayDataOperation = useCallback(
    async (operationId: string): Promise<OperationOutcome> => {
      if (!userId || scope.current.userId !== userId) return { status: "blocked", reason: "no-session" }
      if (journalRef.current === "unreadable") return { status: "blocked", reason: "journal-unreadable" }
      const operation = pendingRef.current.find((value) => value.command.operationId === operationId)
      if (!operation || operation.command.action === "maintenance.batch") return { status: "unknown", operationId }
      const replay = { type: "REPLAY", replayable: OPERATION_POLICY.crud.replayable } as const
      // Only `unknown` may be replayed; a command still sending or being checked is left alone.
      if (transitionOperation(operation.status, replay) !== "sending") return { status: "blocked", reason: "conflict" }
      advanceOperation(operationId, replay)
      return sendDataCommand(userId, operation.command)
    },
    [userId, advanceOperation, sendDataCommand]
  )

  const createVehicle = useCallback(
    (values: VehicleValues) => mutate("vehicle.create", crypto.randomUUID(), values),
    [mutate]
  )
  const updateVehicle = useCallback(
    (id: string, values: VehicleValues) => mutate("vehicle.update", id, values),
    [mutate]
  )
  const deleteVehicle = useCallback((id: string) => mutate("vehicle.delete", id, {}), [mutate])

  // A receipt confirms the transaction; refreshing never changes a confirmed write
  // into a failed write. This context owns all related projection refreshes.
  const acceptMaintenanceReceipt = useCallback(
    (receipt: MaintenanceReceipt) => {
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
    async (input: MaintenanceCommand): Promise<OperationOutcome> => {
      if (!userId || scope.current.userId !== userId) return { status: "blocked", reason: "no-session" }
      if (journalRef.current === "unreadable") return { status: "blocked", reason: "journal-unreadable" }
      const operation = pendingRef.current.find((value) => value.command.operationId === input.operationId)
      if (!operation || operation.command.action !== "maintenance.batch" || operation.status !== "unknown")
        return { status: "unknown", operationId: input.operationId }
      const command = operation.command
      const owner = scope.current
      advanceOperation(command.operationId, { type: "CHECK" })
      try {
        const { data, error } = await supabase
          .rpc("get_maintenance_batch_operation", { p_operation_id: command.operationId })
          .abortSignal(AbortSignal.timeout(15000))
          .retry(false)
        if (scope.current !== owner) return { status: "blocked", reason: "session-changed" }
        const receipt = !error && readMaintenanceReceipt(data, command, userId)
        if (receipt) {
          acceptMaintenanceReceipt(receipt)
          advanceOperation(command.operationId, { type: "RECEIPT" })
          return { status: "confirmed" }
        }
      } catch {
        /* A failed lookup cannot prove rollback. Keep the operation identity. */
      }
      if (scope.current !== owner) return { status: "blocked", reason: "session-changed" }
      advanceOperation(command.operationId, { type: "NO_PROOF" })
      return { status: "unknown", operationId: command.operationId }
    },
    [userId, supabase, acceptMaintenanceReceipt, advanceOperation]
  )

  const createMaintenanceBatch = useCallback(
    async (input: MaintenanceCommand): Promise<OperationOutcome> => {
      const policy = OPERATION_POLICY[operationKind("maintenance.batch")]
      if (!userId || scope.current.userId !== userId) return { status: "blocked", reason: "no-session" }
      if (journalRef.current === "unreadable") return { status: "blocked", reason: "journal-unreadable" }
      const existing = pendingRef.current.find((value) => value.command.action === "maintenance.batch")
      // Only an explicit replay of the retained original is allowed. The caller
      // cannot replace its payload, calendar day, completion mapping or identity.
      if (
        pendingRef.current.some((operation) =>
          conflictsWith(operation, { action: "maintenance.batch", operationId: input.operationId })
        ) ||
        (existing &&
          transitionOperation(existing.status, { type: "REPLAY", replayable: policy.replayable }) !== "sending")
      )
        return { status: "blocked", reason: "conflict" }
      let command = existing?.command
      if (!command) {
        const parsed = maintenanceCommandSchema.safeParse(input)
        if (!parsed.success) return { status: "rejected" }
        command = freezePendingCommand({ ...parsed.data, action: "maintenance.batch" as const })
      }
      if (command.action !== "maintenance.batch") return { status: "rejected" }
      const operationId = command.operationId
      const owner = scope.current
      const stored = publishPending([
        ...pendingRef.current.filter((value) => value !== existing),
        { command, status: "sending" },
      ])
      if (!stored && policy.requiresDurableJournal) {
        // Never send a new batch that cannot survive navigation/session loss.
        if (existing) advanceOperation(operationId, { type: "NO_PROOF" })
        else publishPending(pendingRef.current.filter((value) => value.command.operationId !== operationId))
        recordJournal({ type: "WRITE_FAILED" })
        return { status: "blocked", reason: "journal-unwritable" }
      }
      owner.revision++
      try {
        const { data, error } = await supabase
          .rpc("create_maintenance_batch", maintenanceRpcArgs(command))
          .abortSignal(AbortSignal.timeout(15000))
          .retry(false)
        if (scope.current !== owner) return { status: "blocked", reason: "session-changed" }
        const receipt = !error && readMaintenanceReceipt(data, command, userId)
        if (receipt || isConfirmedRejection(error)) {
          advanceOperation(operationId, { type: receipt ? "RECEIPT" : "REJECTED" })
          if (!receipt) return { status: "rejected" }
          acceptMaintenanceReceipt(receipt)
          return { status: "confirmed" }
        }
      } catch {
        /* Transport cancellation says nothing about database commit. */
      }
      if (scope.current !== owner) return { status: "blocked", reason: "session-changed" }
      advanceOperation(operationId, { type: "NO_PROOF" })
      return policy.autoCheckAfterNoProof ? reconcileMaintenanceBatch(command) : { status: "unknown", operationId }
    },
    [
      userId,
      supabase,
      acceptMaintenanceReceipt,
      reconcileMaintenanceBatch,
      publishPending,
      advanceOperation,
      recordJournal,
    ]
  )

  const updateMaintenance = useCallback(
    (id: string, values: MaintenanceValues) => mutate("maintenance.update", id, values),
    [mutate]
  )
  const deleteMaintenance = useCallback((id: string) => mutate("maintenance.delete", id, {}), [mutate])
  const createScheduledService = useCallback(
    (vehicleId: string, values: ScheduledServiceValues) =>
      mutate("schedule.create", crypto.randomUUID(), { ...values, vehicle_id: vehicleId }),
    [mutate]
  )
  const updateScheduledService = useCallback(
    (id: string, values: ScheduledServiceValues) => mutate("schedule.update", id, values),
    [mutate]
  )
  const cancelScheduledService = useCallback((id: string) => mutate("schedule.cancel", id, {}), [mutate])

  useEffect(() => {
    deletedVehicles.current.clear()
    setDataOwner(userId)
    let restore: JournalEvent = { type: "RESTORED" }
    try {
      pendingRef.current = userId
        ? readPendingCommands(userId).map((command) => ({ command, status: "unknown" as const }))
        : []
    } catch {
      pendingRef.current = []
      restore = { type: "RESTORE_FAILED" }
    }
    setPendingOperations(pendingRef.current)
    recordJournal(restore)
    setTotals(null)
    updateHistory({ type: "INVALIDATE" })
    setVehicles([])
    setMaintenanceRecords([])
    setScheduledServices([])
    dispatchSnapshot({ type: "ACCOUNT_CHANGED", signedIn: !!userId })
    if (userId) void loadAllForUser(userId)
  }, [userId, loadAllForUser, publishPending, recordJournal, updateHistory])

  let visibleVehicles = vehicles
  let visibleRecords = maintenanceRecords
  let visibleSchedules = scheduledServices
  for (const { command } of pendingOperations) {
    if (command.action === "maintenance.batch") continue
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

  // Until the account-change effect runs, the previous account's data is not this account's.
  const isOwnerCurrent = dataOwner === userId
  const isFetching = snapshotIsFetching(snapshotState)
  const ownedData: OwnedData = isOwnerCurrent
    ? {
        snapshot: snapshotState,
        history:
          history.status === "ready"
            ? {
                vehicleId: history.vehicleId,
                records: history.records,
                totals: history.totals,
                page: history.page,
                hasNext: history.hasNext,
              }
            : null,
        totals,
        journal,
        pendingOperations,
        vehicles: visibleVehicles,
        maintenanceRecords: visibleRecords,
        scheduledServices: visibleSchedules,
      }
    : {
        snapshot: userId ? { status: "pending", isFetching } : { status: "signedOut" },
        history: null,
        totals: null,
        journal: "healthy",
        pendingOperations: [],
        vehicles: [],
        maintenanceRecords: [],
        scheduledServices: [],
      }
  const { snapshot } = ownedData

  const value: DataContextType = {
    ...ownedData,
    selectHistory,
    changeHistoryPage,
    operationStorageError: ownedData.journal !== "healthy",
    reconcileDataOperation,
    replayDataOperation,
    snapshotStatus: snapshot.status,
    hasLoaded: snapshot.status === "ready",
    loadError: snapshotLoadError(snapshot),

    // Loading states
    isLoading: isFetching,
    isVehiclesLoading: isFetching,
    isMaintenanceLoading: isFetching,
    isScheduledServicesLoading: isFetching,

    // Actions
    refreshAll,
    refreshVehicles,
    refreshMaintenance,
    refreshScheduledServices,

    // Mutations
    createVehicle,
    updateVehicle,
    deleteVehicle,
    createMaintenanceBatch,
    reconcileMaintenanceBatch,
    updateMaintenance,
    deleteMaintenance,
    createScheduledService,
    updateScheduledService,
    cancelScheduledService,
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
