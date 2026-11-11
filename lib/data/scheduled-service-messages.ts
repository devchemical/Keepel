// Spanish copy for scheduled-service (forecast) states outside operation outcomes.

import { maintenanceTypeLabel } from "./maintenance-types"
import type { CompletedForecast } from "./queries"
import { formatDate } from "@/lib/formatters"

/** Delete-dialog warning for a record that completed a forecast. */
export function completedForecastWarning(forecast: CompletedForecast): string {
  const date = forecast.scheduled_date ? ` del ${formatDate(forecast.scheduled_date)}` : ""
  return `Este registro completó la previsión de ${maintenanceTypeLabel(forecast.type)}${date}. Al eliminarlo, la previsión volverá a quedar pendiente.`
}
