import { describe, expect, it } from "vitest"
import type { ScheduledServiceStatus } from "@/lib/data/scheduled-service-lifecycle"
import { classifyScheduledService, selectScheduledServices } from "@/lib/data/scheduled-services"

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
