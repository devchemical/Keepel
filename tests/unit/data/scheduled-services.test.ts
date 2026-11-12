import { describe, expect, it } from "vitest"
import type { ScheduledServiceStatus } from "@/lib/data/scheduled-service-lifecycle"
import {
  classifyScheduledService,
  selectLaterScheduledServices,
  selectScheduledServices,
} from "@/lib/data/scheduled-services"

const pending = {
  status: "pending" as ScheduledServiceStatus,
  scheduled_date: null,
  scheduled_mileage: null,
  vehicles: { mileage: 0 },
}
describe("scheduled reminder selection", () => {
  it("includes yesterday, today, the inclusive horizon and reached mileage, without estimating unreached mileage", () => {
    const services = [
      { ...pending, id: "yesterday", scheduled_date: "2026-03-07" },
      { ...pending, id: "today", scheduled_date: "2026-03-08" },
      { ...pending, id: "day30", scheduled_date: "2026-04-07" },
      { ...pending, id: "day31", scheduled_date: "2026-04-08" },
      { ...pending, id: "zero", scheduled_mileage: 0 },
      { ...pending, id: "unreached", scheduled_mileage: 1 },
      { ...pending, id: "unknown-mileage", scheduled_mileage: 0, vehicles: { mileage: null } },
      { ...pending, id: "or", scheduled_date: "2027-01-01", scheduled_mileage: 0 },
      { ...pending, id: "cancelled", status: "cancelled" as const, scheduled_date: "2026-03-07" },
      { ...pending, id: "completed", status: "completed" as const, scheduled_mileage: 0 },
    ]
    expect(selectScheduledServices(services, "2026-03-08").map(({ service }) => service.id)).toEqual([
      "yesterday",
      "or",
      "zero",
      "today",
      "day30",
    ])
    expect(classifyScheduledService(services[1], "2026-03-08")).toEqual({ urgency: "today", daysUntil: 0 })
    expect(classifyScheduledService(services[4], "2026-03-08")).toEqual({ urgency: "overdue", daysUntil: null })
  })
})

describe("later forecast selection", () => {
  it("lists only pending later forecasts: dated by date, then mileage-only by mileage, then without criteria", () => {
    const services = [
      { ...pending, id: "no-criteria", vehicles: { mileage: 100 } },
      { ...pending, id: "mileage-200", scheduled_mileage: 200, vehicles: { mileage: 100 } },
      { ...pending, id: "day60", scheduled_date: "2026-05-07" },
      { ...pending, id: "unknown-mileage", scheduled_mileage: 50, vehicles: { mileage: null } },
      { ...pending, id: "day31", scheduled_date: "2026-04-08" },
      { ...pending, id: "day31-reached", scheduled_date: "2026-04-08", scheduled_mileage: 0 },
      { ...pending, id: "day40-unreached", scheduled_date: "2026-04-17", scheduled_mileage: 10 },
      { ...pending, id: "upcoming", scheduled_date: "2026-04-07" },
      { ...pending, id: "overdue", scheduled_date: "2026-03-07" },
      { ...pending, id: "cancelled", status: "cancelled" as const, scheduled_date: "2026-05-07" },
      { ...pending, id: "completed", status: "completed" as const, scheduled_mileage: 500 },
    ]
    const later = selectLaterScheduledServices(services, "2026-03-08")
    expect(later.map(({ service }) => service.id)).toEqual([
      "day31",
      "day40-unreached",
      "day60",
      "unknown-mileage",
      "mileage-200",
      "no-criteria",
    ])
    expect(later.every(({ urgency }) => urgency === "later")).toBe(true)
    expect(later[0].daysUntil).toBe(31)
  })

  it("is disjoint from the reminders, which together cover every pending forecast", () => {
    const services = [
      { ...pending, id: "a", scheduled_date: "2026-03-08" },
      { ...pending, id: "b", scheduled_date: "2026-06-01" },
      { ...pending, id: "c", scheduled_mileage: 5 },
    ]
    const reminders = selectScheduledServices(services, "2026-03-08").map(({ service }) => service.id)
    const later = selectLaterScheduledServices(services, "2026-03-08").map(({ service }) => service.id)
    expect(reminders).toEqual(["a"])
    expect(later).toEqual(["b", "c"])
  })
})

describe("complete scheduled editor values", () => {
  it("normalizes optional clears and preserves zero", async () => {
    const { scheduledServiceSchema } = await import("@/lib/data/scheduled-command")
    expect(
      scheduledServiceSchema.parse({
        type: "other",
        scheduled_mileage: "0",
        scheduled_date: "",
        description: " ",
        notes: "",
      })
    ).toEqual({
      type: "other",
      scheduled_mileage: 0,
      scheduled_date: null,
      description: null,
      notes: null,
    })
  })
  it.each([
    {},
    { type: "other" },
    { type: "other", scheduled_date: "2026-02-30" },
    { type: "other", scheduled_mileage: "12km" },
    { type: "other", scheduled_mileage: "1.5" },
    { type: "other", scheduled_mileage: -1 },
    { type: "unknown", scheduled_date: "2026-03-08" },
  ])("rejects invalid or absent criteria: %j", async (input) => {
    const { scheduledServiceSchema } = await import("@/lib/data/scheduled-command")
    expect(scheduledServiceSchema.safeParse(input).success).toBe(false)
  })
})
