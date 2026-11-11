import { describe, expect, it } from "vitest"
import { classifyScheduledService, selectScheduledServices } from "@/lib/data/scheduled-services"
import {
  SCHEDULE_URGENCY,
  SCHEDULED_SERVICE_EVENT,
  SCHEDULED_SERVICE_STATUS,
  SCHEDULED_SERVICE_TRANSITIONS,
  canTransition,
  isPendingScheduledService,
} from "@/lib/data/scheduled-service-lifecycle"

// Independent copy of the spec table ("Machine 9"): from → event → to. Every pair not listed is refused.
const ALLOWED: Record<string, string> = {
  "null CREATE": "pending",
  "pending UPDATE": "pending",
  "pending COMPLETE": "completed",
  "pending CANCEL": "cancelled",
  "completed COMPLETION_DELETED": "pending",
}

describe("scheduled service lifecycle", () => {
  const states = [null, ...SCHEDULED_SERVICE_STATUS]
  const pairs = states.flatMap((from) => SCHEDULED_SERVICE_EVENT.map((event) => [from, event] as const))

  it("declares exactly the persisted statuses and events", () => {
    expect(SCHEDULED_SERVICE_STATUS).toEqual(["pending", "completed", "cancelled"])
    expect(SCHEDULED_SERVICE_EVENT).toEqual(["CREATE", "UPDATE", "COMPLETE", "CANCEL", "COMPLETION_DELETED"])
  })

  it.each(pairs)("%s + %s matches the table", (from, event) => {
    const expected = ALLOWED[`${from} ${event}`]
    expect(canTransition(from, event)).toBe(expected !== undefined)
    const row = SCHEDULED_SERVICE_TRANSITIONS.find((value) => value.from === from && value.event === event)
    expect(row?.to).toBe(expected)
  })

  it("lists each allowed transition once", () => {
    expect(SCHEDULED_SERVICE_TRANSITIONS).toHaveLength(Object.keys(ALLOWED).length)
  })

  it("treats cancelled as terminal", () => {
    expect(SCHEDULED_SERVICE_EVENT.map((event) => canTransition("cancelled", event))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it("recognises only pending services as open", () => {
    expect(SCHEDULED_SERVICE_STATUS.filter(isPendingScheduledService)).toEqual(["pending"])
    expect(isPendingScheduledService("unknown")).toBe(false)
  })
})

describe("schedule urgency", () => {
  const today = "2026-03-08"
  const pending = { status: "pending", scheduled_date: null, scheduled_mileage: null, vehicles: { mileage: 10 } }

  it("names all four urgencies", () => {
    expect(SCHEDULE_URGENCY).toEqual(["overdue", "today", "upcoming", "later"])
  })

  it.each([
    ["past date", { scheduled_date: "2026-03-07" }, { urgency: "overdue", daysUntil: -1 }],
    ["reached mileage", { scheduled_mileage: 10 }, { urgency: "overdue", daysUntil: null }],
    ["today", { scheduled_date: today }, { urgency: "today", daysUntil: 0 }],
    ["last horizon day", { scheduled_date: "2026-04-07" }, { urgency: "upcoming", daysUntil: 30 }],
    ["beyond the horizon", { scheduled_date: "2026-04-08" }, { urgency: "later", daysUntil: 31 }],
    ["unreached mileage", { scheduled_mileage: 11 }, { urgency: "later", daysUntil: null }],
    [
      "unknown vehicle mileage",
      { scheduled_mileage: 0, vehicles: { mileage: null } },
      { urgency: "later", daysUntil: null },
    ],
  ])("classifies a pending service with %s", (_, criteria, expected) => {
    expect(classifyScheduledService({ ...pending, ...criteria }, today)).toEqual(expected)
  })

  it.each(["completed", "cancelled"])("does not classify a %s service", (status) => {
    expect(classifyScheduledService({ ...pending, status, scheduled_date: "2026-03-07" }, today)).toBeNull()
  })

  it("keeps later services off the dashboard selection", () => {
    const services = [
      { ...pending, id: "later", scheduled_date: "2026-04-08" },
      { ...pending, id: "upcoming", scheduled_date: "2026-04-07" },
    ]
    expect(selectScheduledServices(services, today).map(({ service }) => service.id)).toEqual(["upcoming"])
  })
})
