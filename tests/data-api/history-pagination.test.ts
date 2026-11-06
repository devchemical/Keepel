import { beforeAll, expect, test } from "vitest"
import { randomUUID } from "node:crypto"
import { createAccount, prepareDatabase, ordinaryClient } from "./support"
import { maintenanceHistoryQuery, readDataSnapshot } from "../../lib/data/queries"

beforeAll(() => prepareDatabase(), 60000)

test("all tied history beyond the API cap is reachable once and aggregates cover the complete account and vehicle", async () => {
  const alice = await createAccount("history")
  const bob = await createAccount("history-other")
  const vehicleId = randomUUID()
  const secondId = randomUUID()
  expect(
    (
      await alice.client
        .from("vehicles")
        .insert(
          [vehicleId, secondId].map((id) => ({ id, user_id: alice.id, make: "History", model: "Test", year: 2026 }))
        )
    ).error
  ).toBeNull()
  const rows = Array.from({ length: 1007 }, (_, i) => ({
    id: randomUUID(),
    user_id: alice.id,
    vehicle_id: vehicleId,
    type: "other",
    description: `History ${i}`,
    service_date: i < 1003 ? "2026-03-08" : "2025-01-01",
    cost: i === 1006 ? null : 2.5,
  }))
  for (let i = 0; i < rows.length; i += 400)
    expect((await alice.client.from("maintenance_records").insert(rows.slice(i, i + 400))).error).toBeNull()
  expect(
    (
      await alice.client
        .from("maintenance_records")
        .insert({ user_id: alice.id, vehicle_id: secondId, type: "other", service_date: "2026-04-01", cost: 9 })
    ).error
  ).toBeNull()
  expect((await alice.client.from("maintenance_records").select("id")).data).toHaveLength(1000)
  expect((await maintenanceHistoryQuery(bob.client, alice.id, vehicleId)).data).toEqual([])
  expect((await maintenanceHistoryQuery(alice.client, alice.id, secondId)).data).toHaveLength(1)
  expect((await ordinaryClient().rpc("maintenance_totals")).error).not.toBeNull()
  const totals = () => alice.client.rpc("maintenance_totals", { p_vehicle_id: vehicleId })
  expect((await totals()).data).toEqual([{ record_count: 1007, total_cost: 2515 }])
  expect((await alice.client.rpc("maintenance_totals")).data).toEqual([{ record_count: 1008, total_cost: 2524 }])
  expect((await bob.client.rpc("maintenance_totals", { p_vehicle_id: vehicleId })).data).toEqual([
    { record_count: 0, total_cost: 0 },
  ])
  const seen: string[] = []
  let cursor: { service_date: string; id: string } | undefined
  for (;;) {
    const page = await maintenanceHistoryQuery(alice.client, alice.id, vehicleId, cursor)
    expect(page.error).toBeNull()
    if (!page.data) throw new Error("No page")
    expect(page.data.length).toBeLessThanOrEqual(25)
    if (!page.data.length) break
    seen.push(...page.data.map((row) => row.id))
    cursor = page.data.at(-1)
  }
  expect(seen).toEqual(
    rows
      .toSorted((a, b) => b.service_date.localeCompare(a.service_date) || b.id.localeCompare(a.id))
      .map((row) => row.id)
  )
  expect(new Set(seen).size).toBe(1007)
  expect((await totals()).data).toEqual([{ record_count: 1007, total_cost: 2515 }])
  const snapshot = await readDataSnapshot(alice.client, alice.id)
  expect(snapshot.maintenanceRecords).toHaveLength(5)
  expect(snapshot.totals).toEqual({ record_count: 1008, total_cost: 2524 })
  expect((await alice.client.from("maintenance_records").update({ cost: 10 }).eq("id", rows[0].id)).error).toBeNull()
  expect((await totals()).data).toEqual([{ record_count: 1007, total_cost: 2522.5 }])
  expect((await alice.client.from("maintenance_records").delete().eq("id", rows[0].id)).error).toBeNull()
  expect((await totals()).data).toEqual([{ record_count: 1006, total_cost: 2512.5 }])
  expect((await alice.client.from("vehicles").delete().eq("id", vehicleId)).error).toBeNull()
  expect((await alice.client.rpc("maintenance_totals")).data).toEqual([{ record_count: 1, total_cost: 9 }])
}, 60000)

test("vehicle selectors and forecast counts include collections above the response cap", async () => {
  const account = await createAccount("collections")
  const vehicles = Array.from({ length: 1003 }, () => ({
    id: randomUUID(),
    user_id: account.id,
    make: "Collection",
    model: "Test",
    year: 2026,
  }))
  for (let i = 0; i < vehicles.length; i += 400)
    expect((await account.client.from("vehicles").insert(vehicles.slice(i, i + 400))).error).toBeNull()
  const schedules = vehicles.map((row) => ({
    id: randomUUID(),
    user_id: account.id,
    vehicle_id: row.id,
    type: "other",
    scheduled_mileage: 0,
  }))
  for (let i = 0; i < schedules.length; i += 400)
    expect((await account.client.from("scheduled_services").insert(schedules.slice(i, i + 400))).error).toBeNull()
  const snapshot = await readDataSnapshot(account.client, account.id)
  expect(snapshot.vehicles).toHaveLength(1003)
  expect(new Set(snapshot.vehicles.map((row) => row.id)).size).toBe(1003)
  expect(snapshot.scheduledServices).toHaveLength(1003)
  expect(new Set(snapshot.scheduledServices.map((row) => row.id)).size).toBe(1003)
  expect(snapshot.totals).toEqual({ record_count: 0, total_cost: 0 })
}, 60000)
