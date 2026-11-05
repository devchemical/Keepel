import { expect, test } from "@playwright/test"
import { loginWithPassword } from "./support/auth"
import { CONTROLLED_SERVICES_URL } from "./support/controlled-services-config"

const vehicleId = "00000000-0000-4000-8000-000000000093"
const records = Array.from({ length: 53 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  vehicle_id: vehicleId,
  user_id: "00000000-0000-4000-8000-000000000051",
  type: "other",
  description: `Registro ${i}`,
  cost: 2,
  mileage: 0,
  service_date: "2026-03-08",
  notes: null,
  created_at: null,
  updated_at: null,
}))

test("history pages reach every tied record once, keep complete totals, and retain a valid page on failed navigation", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true, records } })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await expect(page.getByText("53 registro(s) de mantenimiento", { exact: true })).toBeVisible()
  await expect(page.getByText("Gasto total: 106,00", { exact: false })).toBeVisible()
  const seen: string[] = []
  for (let number = 1; number <= 3; number++) {
    await expect(page.getByText(`Página ${number}`, { exact: true })).toBeVisible()
    seen.push(...(await page.getByText(/^Registro \d+$/).allTextContents()))
    if (number < 3) await page.getByRole("button", { name: "Página siguiente" }).click()
  }
  expect(new Set(seen).size).toBe(53)
  expect(seen).toHaveLength(53)
  await page.route("**/rest/v1/maintenance_records?**", (route) =>
    route.fulfill({ status: 503, json: { message: "Unavailable" } })
  )
  await page.getByRole("button", { name: "Página anterior" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "No se pudieron cargar" })).toBeVisible()
  await expect(page.getByText("Página 3", { exact: true })).toBeVisible()
  await expect(page.getByText("Registro 0", { exact: true })).toBeVisible()
  const failedAgain = page.waitForResponse(
    (response) => response.url().includes("/rest/v1/maintenance_records?") && response.status() === 503
  )
  await page.getByRole("button", { name: "Página anterior" }).click()
  await failedAgain
  await page.unroute("**/rest/v1/maintenance_records?**")
  await page.getByRole("button", { name: "Reintentar carga" }).click()
  await expect(page.getByText("Página 2", { exact: true })).toBeVisible()
  await expect(page.getByText("53 registro(s) de mantenimiento", { exact: true })).toBeVisible()
})

test("initial history failure never becomes empty, retry loads the page", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true, records: [] } })
  await page.route("**/rest/v1/maintenance_records?**", (route) =>
    route.request().url().includes("vehicle_id=")
      ? route.fulfill({ status: 503, json: { message: "Unavailable" } })
      : route.continue()
  )
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await expect(page.getByRole("alert").filter({ hasText: "No se pudieron cargar" })).toBeVisible()
  await expect(page.getByText("No hay registros de mantenimiento", { exact: true })).toHaveCount(0)
  await page.unroute("**/rest/v1/maintenance_records?**")
  await page.getByRole("button", { name: "Reintentar carga" }).click()
  await expect(page.getByText("No hay registros de mantenimiento", { exact: true })).toBeVisible()
  await expect(page.getByText("0 registro(s) de mantenimiento", { exact: true })).toBeVisible()
})

test("confirmed edits invalidate a later page and totals even when refresh fails, then retry reorders the first page", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true, records } })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await page.getByRole("button", { name: "Página siguiente" }).click()
  await expect(page.getByText("Página 2", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Acciones del mantenimiento Otro" }).first().click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar Registro de Mantenimiento", exact: true })
  await dialog.getByLabel("Descripción", { exact: true }).fill("Edited and reordered")
  await dialog.getByLabel("Costo (€)", { exact: true }).fill("10")
  await dialog.getByLabel("Fecha de Servicio", { exact: false }).fill("2026-04-01")
  await page.route("**/rest/v1/maintenance_records?**", (route) =>
    route.fulfill({ status: 503, json: { message: "Unavailable" } })
  )
  await dialog.getByRole("button", { name: "Actualizar Mantenimiento", exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("alert").filter({ hasText: "No se pudieron cargar" })).toBeVisible()
  await expect(page.getByText("Página 2", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Gasto total:", { exact: false })).toHaveCount(0)
  await expect(page.getByText(/^Registro \d+$/)).toHaveCount(0)
  await page.unroute("**/rest/v1/maintenance_records?**")
  await page.getByRole("button", { name: "Reintentar carga" }).click()
  await expect(page.getByText("Página 1", { exact: true })).toBeVisible()
  await expect(page.getByText("Edited and reordered", { exact: true })).toBeVisible()
  await expect(page.getByText("Gasto total: 114,00", { exact: false })).toBeVisible()
  await expect(page.getByText("53 registro(s) de mantenimiento", { exact: true })).toBeVisible()
})
