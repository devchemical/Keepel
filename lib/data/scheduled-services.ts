import { calendarDaysBetween, parseCalendarDay } from "@/lib/data/calendar-day"

export const SCHEDULE_HORIZON_DAYS = 30

interface ScheduleCriteria {
  status: string
  scheduled_date?: string | null
  scheduled_mileage?: number | null
  vehicles?: { mileage: number | null }
}
export interface ScheduleClassification {
  urgency: "overdue" | "today" | "upcoming"
  daysUntil: number | null
}

/** Unreached mileage has no temporal estimate and alone does not enter the date horizon. */
export function classifyScheduledService(service: ScheduleCriteria, today: string): ScheduleClassification | null {
  parseCalendarDay(today)
  if (service.status !== "pending") return null
  const scheduledDate = service.scheduled_date ?? null
  const scheduledMileage = service.scheduled_mileage ?? null
  const currentMileage = service.vehicles?.mileage ?? null
  const daysUntil = scheduledDate === null ? null : calendarDaysBetween(today, scheduledDate)
  const reached = scheduledMileage !== null && currentMileage !== null && currentMileage >= scheduledMileage
  if ((daysUntil !== null && daysUntil < 0) || reached) return { urgency: "overdue", daysUntil }
  if (daysUntil === 0) return { urgency: "today", daysUntil }
  if (daysUntil !== null && daysUntil <= SCHEDULE_HORIZON_DAYS) return { urgency: "upcoming", daysUntil }
  return null
}

/** One ordered projection is passed to both the dashboard list and its counter. */
export function selectScheduledServices<T extends ScheduleCriteria>(services: readonly T[], today: string) {
  return services
    .flatMap((service) => {
      const classification = classifyScheduledService(service, today)
      return classification ? [{ service, ...classification }] : []
    })
    .toSorted((a, b) => {
      const rank = { overdue: 0, today: 1, upcoming: 2 }
      return rank[a.urgency] - rank[b.urgency] || (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity)
    })
}
