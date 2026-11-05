import { expect, test } from "@playwright/test"
import { loginWithPassword } from "./support/auth"
import { CONTROLLED_SERVICES_URL } from "./support/controlled-services-config"

const vehicleId = "00000000-0000-4000-8000-000000000093"
test("partial maintenance rows stay visible and block the entire batch until corrected", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await page.getByRole("button", { name: "Agregar Primer Mantenimiento" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Mantenimiento" })
  await dialog.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Cambio de Aceite", exact: true }).click()
  await dialog.getByPlaceholder("0.00").first().fill("0")
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click()
  await dialog.getByPlaceholder("Marca, modelo...").nth(1).fill("Fila parcial que no se debe perder")
  await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("Servicio #2")
  await expect(dialog.getByPlaceholder("Marca, modelo...").nth(1)).toHaveValue("Fila parcial que no se debe perder")
  expect((await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).records).toEqual([])
  await dialog.getByRole("combobox").nth(1).click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByRole("button", { name: "Agregar Servicios", exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("2 registro(s) de mantenimiento")).toBeVisible()
  await expect(page.getByText("0,00 €", { exact: true })).toBeVisible()
  const saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  expect(saved.records).toHaveLength(2)
  expect(saved.records[0]).toMatchObject({ cost: 0, mileage: null, description: null })
  expect(saved.records[1]).toMatchObject({ cost: null, description: "Fila parcial que no se debe perder" })
})

for (const action of ["Comprobar resultado", "Reintentar misma operación"]) {
  test(`an unconfirmed write keeps its operation identity when choosing ${action}`, async ({ page, request }) => {
    await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
      data: { maintenance: true, maintenanceResponse: "unavailable" },
    })
    await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
    await page.getByRole("button", { name: "Agregar", exact: true }).click()
    await page.getByRole("menuitem", { name: "Registrar Mantenimiento", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Agregar Mantenimiento" })
    await dialog.getByRole("combobox").first().click()
    await page.getByRole("option", { name: "Cambio de Aceite", exact: true }).click()
    await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
    await expect(dialog.getByRole("alert")).toContainText("Resultado pendiente de confirmar")
    await expect(dialog.getByRole("combobox").first()).toBeDisabled()
    const uncertain = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
    expect(uncertain.records).toHaveLength(1)
    expect(uncertain.attempts).toHaveLength(1)
    await request.post(`${CONTROLLED_SERVICES_URL}/__test__/maintenance-response`, { data: { available: true } })
    await dialog.getByRole("button", { name: action, exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText("1 registro(s) de mantenimiento")).toBeVisible()
    const confirmed = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
    expect(confirmed.records).toHaveLength(1)
    expect(new Set(confirmed.attempts).size).toBe(1)
    expect(confirmed.attempts).toHaveLength(action === "Comprobar resultado" ? 1 : 2)
  })
}

test("explicit forecast completion links the selected performed row after an empty row is omitted", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: { maintenance: true, maintenanceSchedule: true },
  })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Registrar Mantenimiento", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Mantenimiento" })
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click()
  await dialog.getByRole("combobox").nth(1).click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByLabel("Resolver una previsión (opcional)").click()
  await page.getByRole("option", { name: "Cambio de Aceite · 2026-01-01", exact: true }).click()
  await expect(dialog.getByLabel("Vincular al servicio")).toContainText("Servicio #2: Otro")
  await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
  await expect(dialog).toBeHidden()
  const saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  expect(saved.records).toHaveLength(1)
  expect(saved.forecast).toMatchObject({ status: "completed", completed_record_id: saved.records[0].id })
})
