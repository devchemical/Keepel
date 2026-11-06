import { expect, test } from "vitest"
import { vehicleValuesSchema, maintenanceValuesSchema, dataCommandSchema } from "@/lib/data/data-command"
import { scheduledServiceSchema } from "@/lib/data/scheduled-command"

const cases = [
  {
    schema: vehicleValuesSchema,
    action: "vehicle.update",
    required: { make: "A", model: "B", year: 2020 },
    optional: { mileage: null, license_plate: null, vin: null, color: null },
  },
  {
    schema: maintenanceValuesSchema,
    action: "maintenance.update",
    required: { type: "other", service_date: "2026-11-06" },
    optional: { description: null, cost: null, mileage: null, notes: null },
  },
  {
    schema: scheduledServiceSchema,
    action: "schedule.update",
    required: { type: "other", scheduled_date: "2026-11-06" },
    optional: { description: null, scheduled_mileage: null, notes: null },
  },
]
for (const { schema, action, required, optional } of cases) {
  test(`${action} requires every editor property and accepts explicit clears`, () => {
    expect(schema.safeParse(required).success).toBe(false)
    const complete = { ...required, ...optional }
    expect(schema.parse(complete)).toEqual(complete)
    for (const key of Object.keys(optional)) {
      const sparse: Record<string, unknown> = { ...complete }
      delete sparse[key]
      expect(schema.safeParse(sparse).success).toBe(false)
      expect(schema.safeParse({ ...complete, [key]: undefined }).success).toBe(false)
      expect(schema.parse({ ...complete, [key]: " " })).toEqual(complete)
      expect(
        dataCommandSchema.safeParse({
          operationId: "00000000-0000-4000-8000-000000000001",
          id: "00000000-0000-4000-8000-000000000002",
          action,
          values: sparse,
        }).success
      ).toBe(false)
    }
  })
}
