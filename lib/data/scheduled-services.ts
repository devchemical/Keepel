import { calendarDaysBetween, parseCalendarDay } from "@/lib/data/calendar-day"
import { isPendingScheduledService, type ScheduledServiceStatus } from "@/lib/data/scheduled-service-lifecycle"

// Schedule urgency (machine 10), derived for a pending service on a calendar day by
// `classifyScheduledService`; other statuses have none.
//
// | urgency  | condition (first match wins)                                     | dashboard |
// | -------- | ---------------------------------------------------------------- | --------- |
// | overdue  | scheduled date before today, or vehicle mileage reached          | shown     |
// | today    | scheduled date is today                                          | shown     |
// | upcoming | scheduled date within the horizon (1–30 days)                    | shown     |
// | later    | anything else: beyond the horizon, unreached or unknown mileage  | collapsed |

export const SCHEDULE_URGENCY = ["overdue", "today", "upcoming", "later"] as const
export type ScheduleUrgency = (typeof SCHEDULE_URGENCY)[number]

export const SCHEDULE_HORIZON_DAYS = 30

interface ScheduleCriteria {
  status: ScheduledServiceStatus
  scheduled_date?: string | null
  scheduled_mileage?: number | null
  vehicles?: { mileage: number | null }
}
export interface ScheduleClassification {
  urgency: ScheduleUrgency
  daysUntil: number | null
}
/** A classification shown as a dashboard reminder; `later` stays out of the list and its counter. */
export type ScheduleReminder = ScheduleClassification & { urgency: Exclude<ScheduleUrgency, "later"> }
/** A classification listed in the dashboard's collapsed "Más adelante" section. */
export type ScheduleLater = ScheduleClassification & { urgency: "later" }

/** A dashboard row: a service with its reminder or later classification. */
export type ScheduledServiceRow<T, C extends ScheduleClassification = ScheduleReminder | ScheduleLater> = C & {
  service: T
}

/** Unreached mileage has no temporal estimate and alone does not enter the date horizon. */
export function classifyScheduledService(service: ScheduleCriteria, today: string): ScheduleClassification | null {
  parseCalendarDay(today)
  if (!isPendingScheduledService(service.status)) return null
  const scheduledDate = service.scheduled_date ?? null
  const scheduledMileage = service.scheduled_mileage ?? null
  const currentMileage = service.vehicles?.mileage ?? null
  const daysUntil = scheduledDate === null ? null : calendarDaysBetween(today, scheduledDate)
  const reached = scheduledMileage !== null && currentMileage !== null && currentMileage >= scheduledMileage
  if ((daysUntil !== null && daysUntil < 0) || reached) return { urgency: "overdue", daysUntil }
  if (daysUntil === 0) return { urgency: "today", daysUntil }
  if (daysUntil !== null && daysUntil <= SCHEDULE_HORIZON_DAYS) return { urgency: "upcoming", daysUntil }
  return { urgency: "later", daysUntil }
}

function isReminder(classification: ScheduleClassification | null): classification is ScheduleReminder {
  return classification !== null && classification.urgency !== "later"
}

/** One ordered projection is passed to both the dashboard list and its counter. */
export function selectScheduledServices<T extends ScheduleCriteria>(services: readonly T[], today: string) {
  return services
    .flatMap((service) => {
      const classification = classifyScheduledService(service, today)
      return isReminder(classification) ? [{ service, ...classification }] : []
    })
    .toSorted((a, b) => {
      const rank = { overdue: 0, today: 1, upcoming: 2 }
      return rank[a.urgency] - rank[b.urgency] || (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity)
    })
}

function isLater(classification: ScheduleClassification | null): classification is ScheduleLater {
  return classification?.urgency === "later"
}

/** Later forecasts: dated ones by date, then mileage-only by scheduled mileage, then those with neither. */
export function selectLaterScheduledServices<T extends ScheduleCriteria>(services: readonly T[], today: string) {
  return services
    .flatMap((service) => {
      const classification = classifyScheduledService(service, today)
      return isLater(classification) ? [{ service, ...classification }] : []
    })
    .toSorted(
      (a, b) =>
        (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity) ||
        (a.service.scheduled_mileage ?? Infinity) - (b.service.scheduled_mileage ?? Infinity)
    )
}
