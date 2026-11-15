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

test("an in-flight batch survives reload with its original reference, calendar day and completion mapping", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: { maintenance: true, maintenanceSchedule: true, maintenanceResponse: "unavailable" },
  })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let operationId = ""
  let submitted!: () => void
  const started = new Promise<void>((resolve) => {
    submitted = resolve
  })
  await page.route("**/rest/v1/rpc/create_maintenance_batch", async (route) => {
    operationId = route.request().postDataJSON().p_operation_id
    submitted()
    await gate
    await route.fetch()
    await route.fulfill({ status: 503, json: { message: "Lost response" } }).catch(() => {})
  })
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Registrar Mantenimiento", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Mantenimiento" })
  await dialog.getByLabel("Fecha de Servicio", { exact: false }).fill("2026-03-08")
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click()
  await dialog.getByRole("combobox").nth(1).click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByLabel("Resolver una previsión (opcional)").click()
  await page.getByRole("option", { name: "Cambio de Aceite · 2026-01-01", exact: true }).click()
  await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
  await started
  try {
    await page.reload()
    await expect(page.getByText(`Referencia: ${operationId}`, { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Agregar", exact: true }).click()
    await page.getByRole("menuitem", { name: "Registrar Mantenimiento", exact: true }).click()
    await expect(dialog.getByLabel("Fecha de Servicio", { exact: false })).toHaveValue("2026-03-08")
    await expect(dialog.getByRole("combobox").first()).toBeDisabled()
    await expect(dialog.getByRole("combobox").first()).toContainText("Otro")
    await expect(dialog.getByRole("button", { name: "Reintentar misma operación", exact: true })).toBeVisible()
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click()
    await page.getByRole("button", { name: "Comprobar resultado", exact: true }).click()
    await expect(page.getByText(`Referencia: ${operationId}`, { exact: true })).toBeVisible()
  } finally {
    release()
  }
  await expect
    .poll(
      async () => (await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).records.length
    )
    .toBe(1)
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/maintenance-response`, { data: { available: true } })
  await page.goto("/vehicles")
  await expect(page.getByText(`Referencia: ${operationId}`, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Comprobar resultado", exact: true }).click()
  await expect(page.getByText(`Referencia: ${operationId}`, { exact: true })).toHaveCount(0)
  const saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  expect(saved.attempts).toEqual([operationId])
  expect(saved.records).toHaveLength(1)
  expect(saved.records[0]).toMatchObject({ service_date: "2026-03-08", type: "other" })
  expect(saved.forecast).toMatchObject({ status: "completed", completed_record_id: saved.records[0].id })
})

test("unknown batch returns only to its account after auth invalidation and another account", async ({
  page,
  request,
  context,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: { maintenance: true, maintenanceResponse: "unavailable" },
  })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await page.getByRole("button", { name: "Agregar Primer Mantenimiento" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Mantenimiento" })
  await dialog.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("Resultado pendiente de confirmar")
  const { attempts } = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  const reference = `Referencia: ${attempts[0]}`
  await context.clearCookies()
  await page.evaluate(() => {
    const channel = new BroadcastChannel("keepel-auth-invalidation")
    // eslint-disable-next-line unicorn/require-post-message-target-origin
    channel.postMessage({ type: "auth-invalidated" })
    channel.close()
  })
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.goto("/auth/login?redirect=/vehicles")
  await page.getByLabel("Email").fill("other@keepel.test")
  await page.getByLabel("Contraseña").fill("correct-horse")
  await page.getByRole("button", { name: "Iniciar Sesión", exact: true }).click()
  await expect(page.getByText("Hola, Ada Driver", { exact: true })).toBeAttached()
  await expect(page.getByText(reference, { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Cerrar sesión" }).click()
  await expect(page).toHaveURL(/\/auth\/login$/)
  await loginWithPassword(page, "/vehicles")
  await expect(page.getByText(reference, { exact: true })).toBeVisible()
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/maintenance-response`, { data: { available: true } })
  await page.getByRole("button", { name: "Comprobar resultado", exact: true }).click()
  await expect(page.getByText(reference, { exact: true })).toHaveCount(0)
  expect((await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).attempts).toEqual(
    attempts
  )
})

test("a native batch rejection leaves the editor available for a corrected operation", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await page.route("**/rest/v1/rpc/create_maintenance_batch", async (route) => {
    await route.fulfill({ status: 400, json: { code: "23514", message: "Controlled constraint rejection" } })
  })
  await page.getByRole("button", { name: "Agregar Primer Mantenimiento" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Mantenimiento" })
  await dialog.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("No se pudo guardar")
  await expect(dialog.getByRole("combobox").first()).toBeEnabled()
  await page.unroute("**/rest/v1/rpc/create_maintenance_batch")
  await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
  await expect(dialog).toBeHidden()
  expect((await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).records).toHaveLength(1)
})

test("a batch is not submitted when its original reference cannot be journaled", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("keepel-pending-data-v1:"))
        throw new DOMException("Controlled storage failure", "QuotaExceededError")
      original.call(this, key, value)
    }
  })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await page.getByRole("button", { name: "Agregar Primer Mantenimiento" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Mantenimiento" })
  await dialog.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
  await expect(dialog.getByText("No se pudo guardar la referencia", { exact: false })).toBeVisible()
  await expect(dialog.getByRole("combobox").first()).toBeEnabled()
  const saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  expect(saved.attempts).toEqual([])
  expect(saved.records).toEqual([])
})

test("an unreadable journal blocks replacement and restores the original when storage returns", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: { maintenance: true, maintenanceResponse: "unavailable" },
  })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await page.getByRole("button", { name: "Agregar Primer Mantenimiento" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Mantenimiento" })
  await dialog.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("Resultado pendiente de confirmar")
  const { attempts } = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (key.startsWith("keepel-pending-data-v1:") && sessionStorage.getItem("deny-journal") === "true")
        throw new DOMException("Controlled read failure", "SecurityError")
      return original.call(this, key)
    }
  })
  await page.evaluate(() => sessionStorage.setItem("deny-journal", "true"))
  await page.reload()
  await expect(page.getByText("No se pudieron conservar o recuperar", { exact: false })).toBeVisible()
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Registrar Mantenimiento", exact: true }).click()
  await dialog.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
  await expect(dialog.getByText("No se pudo guardar la referencia", { exact: false })).toBeVisible()
  expect((await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).attempts).toEqual(
    attempts
  )
  await page.evaluate(() => sessionStorage.setItem("deny-journal", "false"))
  await page.reload()
  await expect(page.getByText(`Referencia: ${attempts[0]}`, { exact: true })).toBeVisible()
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/maintenance-response`, { data: { available: true } })
  await page.getByRole("button", { name: "Comprobar resultado", exact: true }).click()
  await expect(page.getByText(`Referencia: ${attempts[0]}`, { exact: true })).toHaveCount(0)
})
