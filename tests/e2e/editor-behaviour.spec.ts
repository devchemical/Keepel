import { expect, test, type Page } from "@playwright/test"
import { loginWithPassword } from "./support/auth"
import { CONTROLLED_SERVICES_URL } from "./support/controlled-services-config"

// D3 — one editor behaviour: every editor blocks close while submitting, confirmed writes show one
// success toast, and errors stay inline (`role="alert"`) without a toast.

const toasts = (page: Page) => page.locator("[data-sonner-toast]")

test("a CRUD editor stays open while its write is in flight and confirms with one toast", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, "/vehicles")
  let release!: () => void
  const released = new Promise<void>((resolve) => (release = resolve))
  await page.route("**/rest/v1/rpc/mutate_data", async (route) => {
    await released
    await route.continue()
  })
  await page.getByRole("button", { name: "Acciones de Synthetic Maintenance" }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar Vehículo", exact: true })
  await dialog.getByLabel("Marca", { exact: false }).fill("Held")
  await dialog.getByRole("button", { name: "Actualizar Vehículo" }).click()
  await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeDisabled()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()
  release()
  await expect(dialog).toBeHidden()
  await expect(toasts(page)).toHaveCount(1)
  await expect(toasts(page)).toContainText("Vehículo actualizado correctamente")
})

test("a rejected scheduled-service edit shows its error inline only", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: { maintenance: true, maintenanceSchedule: true },
  })
  await loginWithPassword(page)
  await page.route("**/rest/v1/rpc/mutate_data", (route) =>
    route.fulfill({ status: 400, json: { code: "P0001", message: "No affected schedule" } })
  )
  await page.getByRole("button", { name: "Acciones de Cambio de Aceite", exact: true }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar Servicio Programado" })
  await dialog.getByLabel("Kilometraje Programado").fill("1")
  await dialog.getByRole("button", { name: "Guardar Cambios" }).click()
  await expect(dialog.getByRole("alert")).toContainText("No se realizó la operación")
  await expect(toasts(page)).toHaveCount(0)
})

test("a confirmed scheduled-service edit shows exactly one success toast", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: { maintenance: true, maintenanceSchedule: true },
  })
  await loginWithPassword(page)
  await page.getByRole("button", { name: "Acciones de Cambio de Aceite", exact: true }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar Servicio Programado" })
  await dialog.getByLabel("Kilometraje Programado").fill("1")
  await dialog.getByRole("button", { name: "Guardar Cambios" }).click()
  await expect(dialog).toBeHidden()
  await expect(toasts(page)).toHaveCount(1)
  await expect(toasts(page)).toContainText("Servicio actualizado correctamente")
})
