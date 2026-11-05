import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../../lib/supabase/database.types"

// Real Auth, PostgREST, RPC, RLS and SQL; only Redis uses the controlled local service.
test("real account reaches history beyond 1000 once, totals survive paging and a database mutation refresh", async ({
  page,
}) => {
  const connection = JSON.parse(
    execFileSync(
      "bun",
      [
        "-e",
        'import {localConnection,prepareDatabase} from "./tests/data-api/support.ts"; process.env.KEEPEL_DATA_API_TEST="1"; prepareDatabase(); process.stdout.write(JSON.stringify(localConnection()))',
      ],
      { encoding: "utf8" }
    )
  )
  const client = createClient<Database>(connection.url, connection.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = `history-browser-${randomUUID()}@example.test`
  const password = `Local-only-${randomUUID()}`
  const account = await client.auth.signUp({ email, password })
  expect(account.error).toBeNull()
  if (!account.data.user) throw new Error("No synthetic account")
  const userId = account.data.user.id
  const vehicleId = randomUUID()
  expect(
    (
      await client
        .from("vehicles")
        .insert({ id: vehicleId, user_id: userId, make: "Real", model: "History", year: 2026 })
    ).error
  ).toBeNull()
  const records = Array.from({ length: 1007 }, (_, i) => ({
    id: randomUUID(),
    user_id: userId,
    vehicle_id: vehicleId,
    type: "other",
    description: `Real registro ${i}`,
    service_date: i < 1003 ? "2026-03-08" : "2025-01-01",
    cost: 2,
  }))
  for (let i = 0; i < records.length; i += 400)
    expect((await client.from("maintenance_records").insert(records.slice(i, i + 400))).error).toBeNull()
  await page.goto(`/auth/login?redirect=/vehicles/${vehicleId}/maintenance`)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Contraseña").fill(password)
  await page.getByRole("button", { name: "Iniciar Sesión", exact: true }).click()
  await expect(page.getByText("1007 registro(s) de mantenimiento", { exact: true })).toBeVisible()
  const seen: string[] = []
  for (let number = 1; number <= 41; number++) {
    await expect(page.getByText(`Página ${number}`, { exact: true })).toBeVisible()
    await expect(page.getByText("Gasto total: 2014,00", { exact: false })).toBeVisible()
    seen.push(...(await page.getByText(/^Real registro \d+$/).allTextContents()))
    if (number < 41) await page.getByRole("button", { name: "Página siguiente" }).click()
  }
  expect(seen).toHaveLength(1007)
  expect(new Set(seen).size).toBe(1007)
  expect(seen).toEqual(
    records
      .toSorted((a, b) => b.service_date.localeCompare(a.service_date) || b.id.localeCompare(a.id))
      .map((row) => row.description)
  )
  await expect(page.getByRole("button", { name: "Página siguiente" })).toBeDisabled()
  // A confirmed UI deletion invalidates the last page and the independent aggregate.
  await page.getByRole("button", { name: "Acciones del mantenimiento Otro" }).first().click()
  await page.getByRole("menuitem", { name: "Eliminar" }).click()
  await page.getByRole("button", { name: "Eliminar Registro", exact: true }).click()
  await expect(page.getByText("1006 registro(s) de mantenimiento", { exact: true })).toBeVisible()
  await expect(page.getByText("Página 1", { exact: true })).toBeVisible()
  await expect(page.getByText("Gasto total: 2012,00", { exact: false })).toBeVisible()
  expect((await client.rpc("maintenance_totals", { p_vehicle_id: vehicleId })).data).toEqual([
    { record_count: 1006, total_cost: 2012 },
  ])
  await page.getByRole("button", { name: "Acciones del mantenimiento Otro" }).first().click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const edit = page.getByRole("dialog", { name: "Editar Registro de Mantenimiento", exact: true })
  await edit.getByLabel("Costo (€)", { exact: true }).fill("0")
  await edit.getByRole("button", { name: "Actualizar Mantenimiento", exact: true }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByText("Gasto total: 2010,00", { exact: false })).toBeVisible()
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Registrar Mantenimiento", exact: true }).click()
  const add = page.getByRole("dialog", { name: "Agregar Mantenimiento", exact: true })
  await add.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await add.getByPlaceholder("0.00").fill("10")
  await add.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
  await expect(add).toBeHidden()
  await expect(page.getByText("1007 registro(s) de mantenimiento", { exact: true })).toBeVisible()
  await expect(page.getByText("Gasto total: 2020,00", { exact: false })).toBeVisible()
  await page.goto("/")
  await expect(page.getByText("Gasto Total", { exact: true }).locator("../..")).toContainText("2020,00")
  await expect(page.getByText("Mantenimientos", { exact: true }).locator("../..")).toContainText("1007")
  await page.getByRole("link", { name: "Ver Vehículos", exact: true }).click()
  await page.getByRole("button", { name: "Acciones de Real History" }).click()
  await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click()
  await page
    .getByRole("dialog", { name: "Eliminar Vehículo", exact: true })
    .getByRole("button", { name: "Eliminar Vehículo", exact: true })
    .click()
  await expect(page.getByText("No tienes vehículos registrados", { exact: true })).toBeVisible()
  await page.getByRole("banner").locator('a[href="/"]').click()
  await expect(page.getByText("Gasto Total", { exact: true }).locator("../..")).toContainText("0,00")
  expect((await client.rpc("maintenance_totals")).data).toEqual([{ record_count: 0, total_cost: 0 }])
})
