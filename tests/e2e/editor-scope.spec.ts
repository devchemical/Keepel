import { expect, test, type Page } from "@playwright/test"
import { loginWithPassword } from "./support/auth"
import { CONTROLLED_SERVICES_URL } from "./support/controlled-services-config"

// D1 — an editor is frozen and reset only by the operation it submitted. Unrelated editors stay
// usable; the data owner's `conflictsWith` guard is the only app-wide protection.

/** Leaves one committed vehicle edit whose response was lost, so the operation stays unknown. */
async function leaveVehicleEditUnknown(page: Page) {
  await page.route("**/rest/v1/rpc/mutate_data", async (route) => {
    await route.fetch()
    await route.fulfill({ status: 503, json: { message: "Lost response" } })
  })
  await page.getByRole("button", { name: "Acciones de Synthetic Maintenance" }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const editDialog = page.getByRole("dialog", { name: "Editar Vehículo", exact: true })
  await editDialog.getByLabel("Marca", { exact: false }).fill("Uncertain")
  await editDialog.getByRole("button", { name: "Actualizar Vehículo" }).click()
  await expect(editDialog.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  await page.unroute("**/rest/v1/rpc/mutate_data")
  await page.keyboard.press("Escape")
  await expect(editDialog).toBeHidden()
}

async function openAddVehicle(page: Page) {
  await page.getByRole("button", { name: "Agregar Vehículo", exact: true }).click()
  return page.getByRole("dialog", { name: "Agregar Nuevo Vehículo", exact: true })
}

test("confirming an unrelated unresolved operation keeps another editor's draft", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, "/vehicles")
  await leaveVehicleEditUnknown(page)
  const addDialog = await openAddVehicle(page)
  await addDialog.getByLabel("Marca", { exact: false }).fill("Draft")
  await addDialog.getByRole("button", { name: "Comprobar resultado", exact: true }).click()
  await expect(page.getByText("Uncertain Maintenance", { exact: true })).toBeVisible()
  await expect(addDialog.getByRole("status").filter({ hasText: "Resultado pendiente" })).toHaveCount(0)
  await expect(addDialog).toBeVisible()
  await expect(addDialog.getByLabel("Marca", { exact: false })).toHaveValue("Draft")
  await expect(addDialog.getByLabel("Marca", { exact: false })).toBeEnabled()
})

test("an unrelated editor stays usable while another operation is unknown", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, "/vehicles")
  await leaveVehicleEditUnknown(page)
  const addDialog = await openAddVehicle(page)
  await expect(addDialog.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  await addDialog.getByLabel("Marca", { exact: false }).fill("Second")
  await addDialog.getByLabel("Modelo", { exact: false }).fill("Usable")
  await addDialog.getByLabel("Año", { exact: false }).click()
  await page.getByRole("option", { name: String(new Date().getFullYear()), exact: true }).click()
  await addDialog.getByLabel("Kilometraje Actual", { exact: true }).fill("0")
  await addDialog.getByRole("button", { name: "Agregar Vehículo", exact: true }).click()
  await expect(addDialog).toBeHidden()
  await expect(page.getByText("Second Usable", { exact: true })).toBeVisible()
  await expect(page.getByText("Resultado pendiente de confirmar", { exact: false }).first()).toBeVisible()
})
