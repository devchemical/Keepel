export const MAINTENANCE_TYPES = [
  { value: "oil_change", label: "Cambio de Aceite" },
  { value: "tire_rotation", label: "Rotación de Llantas" },
  { value: "brake_service", label: "Servicio de Frenos" },
  { value: "transmission", label: "Transmisión" },
  { value: "engine_tune", label: "Afinación del Motor" },
  { value: "battery", label: "Batería" },
  { value: "air_filter", label: "Filtro de Aire" },
  { value: "coolant", label: "Refrigerante" },
  { value: "spark_plugs", label: "Bujías" },
  { value: "belts_hoses", label: "Correas y Mangueras" },
  { value: "suspension", label: "Suspensión" },
  { value: "exhaust", label: "Sistema de Escape" },
  { value: "other", label: "Otro" },
] as const

export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number]["value"]

export function isMaintenanceType(value: unknown): value is MaintenanceType {
  return MAINTENANCE_TYPES.some((type) => type.value === value)
}
