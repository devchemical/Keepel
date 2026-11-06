import { beforeAll, expect, test } from "vitest"
import { createAccount, prepareDatabase, replayScript } from "./support"

let account: Awaited<ReturnType<typeof createAccount>>
beforeAll(async () => {
  prepareDatabase(9)
  account = await createAccount("criterion-migration")
}, 60000)

test("script010 fails without changing invalid legacy rows, then applies and replays after explicit repair", async () => {
  const vehicle = await account.client
    .from("vehicles")
    .insert({ user_id: account.id, make: "Legacy", model: "Criterion", year: 2020 })
    .select()
    .single()
  if (!vehicle.data) throw new Error("Missing vehicle")
  const invalid = await account.client
    .from("scheduled_services")
    .insert({
      user_id: account.id,
      vehicle_id: vehicle.data.id,
      type: "other",
      scheduled_date: null,
      scheduled_mileage: null,
    })
    .select()
    .single()
  expect(invalid.error).toBeNull()
  if (!invalid.data) throw new Error("Missing legacy fixture")
  expect(() => replayScript(10)).toThrow(/scheduled_services contains rows without date or mileage; explicitly repair/)
  expect((await account.client.from("scheduled_services").select().eq("id", invalid.data.id).single()).data).toEqual(
    invalid.data
  )
  const repaired = await account.client
    .from("scheduled_services")
    .update({ scheduled_mileage: 0 })
    .eq("id", invalid.data.id)
    .select()
    .single()
  expect(repaired.error).toBeNull()
  replayScript(10)
  replayScript(10)
  expect((await account.client.from("scheduled_services").select().eq("id", invalid.data.id).single()).data).toEqual(
    repaired.data
  )
  expect(
    (await account.client.from("scheduled_services").update({ scheduled_mileage: null }).eq("id", invalid.data.id))
      .error?.code
  ).toBe("23514")
})
