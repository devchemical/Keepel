// Context exports
export { AppProviders } from "./AppProviders"
export {
  AuthProjectionProvider,
  AuthProjectionSynchronization,
  useAuthProjection,
  useAuthProjectionInvalidation,
} from "./AuthProjectionContext"
export { DataProvider, useData } from "./DataContext"
export { SupabaseProvider, useSupabase } from "./SupabaseContext"

// Types
export type { Vehicle, MaintenanceRecord, ScheduledService, ScheduledServiceStatus } from "./DataContext"
