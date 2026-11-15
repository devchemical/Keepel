import { expect, test } from "@playwright/test"
import { loginWithPassword } from "./support/auth"
import { CONTROLLED_SERVICES_URL } from "./support/controlled-services-config"

test("initial query error is distinct from empty and a retry recovers", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await page.route("**/rest/v1/vehicles?**", (route) =>
    route.fulfill({ status: 503, json: { message: "Unavailable" } })
  )
  await loginWithPassword(page, "/vehicles")
  await page.waitForURL("**/vehicles")
  await expect(page.getByRole("alert").filter({ hasText: "No se pudieron cargar" })).toContainText(
    "No se pudieron cargar"
  )
  await expect(page.getByText("No tienes vehículos registrados")).toHaveCount(0)
  await page.unroute("**/rest/v1/vehicles?**")
  await page.getByRole("button", { name: "Reintentar carga" }).click()
  await expect(page.getByText("Synthetic Maintenance", { exact: true })).toBeVisible()
})

test("failed refresh retains visible vehicles and retry replaces the error", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, "/vehicles")
  await expect(page.getByText("Synthetic Maintenance", { exact: true })).toBeVisible()
  await page.route("**/rest/v1/vehicles?**", (route) =>
    route.fulfill({ status: 503, json: { message: "Unavailable" } })
  )
  await page.getByRole("button", { name: "Actualizar datos" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "No se pudieron cargar" })).toBeVisible()
  await expect(page.getByText("Synthetic Maintenance", { exact: true })).toBeVisible()
  await page.unroute("**/rest/v1/vehicles?**")
  await page.getByRole("button", { name: "Reintentar carga" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "No se pudieron cargar" })).toHaveCount(0)
  await expect(page.getByText("Synthetic Maintenance", { exact: true })).toBeVisible()
})

test("vehicle identity edits propagate into history, reminders and dashboard", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: { maintenance: true, maintenanceSchedule: true },
  })
  await loginWithPassword(page, "/vehicles")
  await page.getByRole("button", { name: "Acciones de Synthetic Maintenance" }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar Vehículo", exact: true })
  await dialog.getByLabel("Marca", { exact: false }).fill("Updated")
  await dialog.getByRole("button", { name: "Actualizar Vehículo" }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole("link", { name: "Ver Mantenimientos", exact: true }).click()
  await expect(page.getByText("Updated Maintenance", { exact: true })).toBeVisible()
  await page.goto("/")
  await expect(page.getByRole("list", { name: "Previsiones" })).toContainText("Updated Maintenance")
})

test("a lost vehicle edit response stays unknown, freezes the payload and reconciles without another write", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, "/vehicles")
  let attempts = 0
  await page.route("**/rest/v1/rpc/mutate_data", async (route) => {
    attempts++
    await route.fetch() // The transaction committed, but its response was lost.
    await route.fulfill({ status: 503, json: { message: "Lost response" } })
  })
  await page.getByRole("button", { name: "Acciones de Synthetic Maintenance" }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar Vehículo", exact: true })
  await dialog.getByLabel("Marca", { exact: false }).fill("Uncertain")
  await dialog.getByRole("button", { name: "Actualizar Vehículo" }).click()
  await expect(dialog.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  await expect(dialog.getByLabel("Marca", { exact: false })).toBeDisabled()
  await expect(dialog.getByLabel("Marca", { exact: false })).toHaveValue("Uncertain")
  await dialog.getByRole("button", { name: "Comprobar resultado" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Uncertain Maintenance", { exact: true })).toBeVisible()
  expect(attempts).toBe(1)
})

test("a zero-row vehicle update is rejected and never closes as confirmed success", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, "/vehicles")
  await page.route("**/rest/v1/rpc/mutate_data", (route) =>
    route.fulfill({ status: 400, json: { code: "P0001", message: "No affected vehicle" } })
  )
  await page.getByRole("button", { name: "Acciones de Synthetic Maintenance" }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar Vehículo", exact: true })
  await dialog.getByLabel("Marca", { exact: false }).fill("Rejected")
  await dialog.getByRole("button", { name: "Actualizar Vehículo" }).click()
  await expect(dialog.getByRole("alert")).toContainText("No se realizó la operación")
  await expect(dialog.getByLabel("Marca", { exact: false })).toBeEnabled()
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect(page.getByText("Synthetic Maintenance", { exact: true })).toBeVisible()
  await expect(page.getByText("Rejected Maintenance", { exact: true })).toHaveCount(0)
})

test("cancelled scheduled writes remain explicitly unknown until their receipt is queried", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: { maintenance: true, maintenanceSchedule: true },
  })
  await loginWithPassword(page)
  let attempts = 0
  await page.route("**/rest/v1/rpc/mutate_data", async (route) => {
    attempts++
    await route.fetch()
    await route.abort("failed")
  })
  await page.getByRole("button", { name: "Acciones de Cambio de Aceite", exact: true }).click()
  await page.getByRole("menuitem", { name: "Cancelar previsión", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  await expect(page.getByRole("listitem", { name: "Cambio de Aceite", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Comprobar resultado" }).click()
  await expect(page.getByRole("listitem", { name: "Cambio de Aceite", exact: true })).toHaveCount(0)
  await expect(page.getByRole("status").filter({ hasText: "Resultado pendiente" })).toHaveCount(0)
  expect(attempts).toBe(1)
})

test("vehicle deletion cascades through owned history, reminders and totals", async ({ page, request }) => {
  const vehicleId = "00000000-0000-4000-8000-000000000093"
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: {
      maintenance: true,
      maintenanceSchedule: true,
      records: [
        {
          id: "00000000-0000-4000-8000-000000000095",
          vehicle_id: vehicleId,
          user_id: "00000000-0000-4000-8000-000000000051",
          type: "other",
          description: "Cascade record",
          cost: 42,
          mileage: 0,
          service_date: "2026-01-01",
          notes: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    },
  })
  await loginWithPassword(page)
  await expect(page.getByText("Gasto Total", { exact: true }).locator("../..")).toContainText("42,00")
  await page.getByRole("link", { name: "Ver Vehículos", exact: true }).click()
  await page.getByRole("button", { name: "Acciones de Synthetic Maintenance" }).click()
  await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Eliminar Vehículo", exact: true })
  await dialog.getByRole("button", { name: "Eliminar Vehículo", exact: true }).click()
  await expect(page.getByText("No tienes vehículos registrados", { exact: true })).toBeVisible()
  await page.getByRole("banner").locator('a[href="/"]').click()
  await expect(page.getByText("Gasto Total", { exact: true }).locator("../..")).toContainText("0,00")
  await expect(page.getByText("No hay servicios programados", { exact: true })).toBeVisible()
  await expect(page.getByText("Cascade record", { exact: true })).toHaveCount(0)
  await page.goto(`/vehicles/${vehicleId}/maintenance`)
  await expect(page.getByText("Vehículo no disponible.", { exact: false })).toBeVisible()
})

test("an old in-flight read cannot replace data after an authentication projection transition", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page)
  await expect(page.getByText("Synthetic Maintenance", { exact: true })).toBeVisible()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let first = true
  let started!: () => void
  const held = new Promise<void>((resolve) => {
    started = resolve
  })
  await page.route("**/rest/v1/vehicles?**", async (route) => {
    const response = await route.fetch()
    const rows = await response.json()
    if (first) {
      first = false
      started()
      await gate
      await route.fulfill({ json: rows.map((row: Record<string, unknown>) => ({ ...row, make: "Previous session" })) })
    } else
      await route.fulfill({ json: rows.map((row: Record<string, unknown>) => ({ ...row, make: "Current session" })) })
  })
  await page.getByRole("button", { name: "Actualizar datos" }).click()
  await held
  await page.evaluate(() => {
    const channel = new BroadcastChannel("keepel-auth-invalidation")
    // BroadcastChannel is scoped to the same origin; it has no targetOrigin argument.
    // eslint-disable-next-line unicorn/require-post-message-target-origin
    channel.postMessage({ type: "auth-invalidated" })
    channel.close()
  })
  await expect(page.getByText("Current session Maintenance", { exact: true })).toBeVisible()
  const staleResponse = page.waitForResponse(
    async (response) =>
      response.url().includes("/rest/v1/vehicles?") &&
      response.status() === 200 &&
      (await response.json())[0]?.make === "Previous session"
  )
  release()
  await (await staleResponse).finished()
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  )
  await expect(page.getByRole("button", { name: "Actualizar datos" })).toBeEnabled()
  await expect(page.getByText("Previous session Maintenance", { exact: true })).toHaveCount(0)
  await expect(page.getByText("Current session Maintenance", { exact: true })).toBeVisible()
})

test("a delayed create is sent once and cancellation of the client wait does not imply rollback", async ({
  page,
  request,
}) => {
  test.setTimeout(45000)
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, "/vehicles/00000000-0000-4000-8000-000000000093/maintenance")
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let attempts = 0
  await page.route("**/rest/v1/rpc/mutate_data", async (route) => {
    attempts++
    const response = await route.fetch()
    await gate
    await route.fulfill({ response }).catch(() => {}) // Browser may have cancelled its wait.
  })
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Programar Servicio", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Programar Servicio", exact: true })
  await dialog.getByLabel("Tipo de Servicio", { exact: false }).click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByLabel("Kilometraje Programado").fill("0")
  await dialog.getByRole("button", { name: "Programar Servicio", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Resultado pendiente de confirmar", { timeout: 20000 })
  await expect(dialog.getByLabel("Kilometraje Programado")).toBeDisabled()
  await page.route("**/rest/v1/rpc/get_data_operation", (route) => route.fulfill({ json: null }))
  await dialog.getByRole("button", { name: "Comprobar resultado" }).click()
  await expect(dialog.getByRole("button", { name: "Comprobar resultado" })).toBeEnabled()
  await expect(dialog.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  await page.unroute("**/rest/v1/rpc/get_data_operation")
  await dialog.getByRole("button", { name: "Comprobar resultado" }).click()
  await expect(dialog).toBeHidden()
  release()
  expect(attempts).toBe(1)
  expect((await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).schedules).toHaveLength(
    1
  )
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Programar Servicio", exact: true }).click()
  await expect(dialog.getByLabel("Kilometraje Programado")).toHaveValue("")
  await expect(dialog.getByRole("alert")).toHaveCount(0)
})

test("an unresolved create retains its immutable operation across reload and can query or replay it", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, "/vehicles/00000000-0000-4000-8000-000000000093/maintenance")
  const operationIds: string[] = []
  await page.route("**/rest/v1/rpc/mutate_data", async (route) => {
    operationIds.push((route.request().postDataJSON() as { p_operation_id: string }).p_operation_id)
    const response = await route.fetch()
    // Only the first response is lost; the write itself reached the database.
    if (operationIds.length === 1) await route.fulfill({ status: 503, json: { message: "Lost response" } })
    else await route.fulfill({ response })
  })
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Programar Servicio", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Programar Servicio", exact: true })
  await dialog.getByLabel("Tipo de Servicio", { exact: false }).click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByLabel("Kilometraje Programado").fill("0")
  await dialog.getByRole("button", { name: "Programar Servicio", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  const reference = await dialog.getByText("Referencia:", { exact: false }).textContent()
  if (!reference) throw new Error("Missing unresolved operation reference")
  await page.reload()
  await expect(page.getByText(reference, { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Comprobar resultado", exact: true })).toBeEnabled()
  // Replaying the same operation id returns the original receipt instead of writing again.
  await page.getByRole("button", { name: "Reintentar misma operación", exact: true }).click()
  await expect(page.getByText(reference, { exact: true })).toHaveCount(0)
  expect(operationIds).toHaveLength(2)
  expect(operationIds[1]).toBe(operationIds[0])
  expect(reference).toContain(operationIds[0])
  expect((await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).schedules).toHaveLength(
    1
  )
})

test("a lost CRUD request is replayed explicitly from its editor once and writes exactly one row", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, "/vehicles/00000000-0000-4000-8000-000000000093/maintenance")
  const operationIds: string[] = []
  await page.route("**/rest/v1/rpc/mutate_data", async (route) => {
    operationIds.push((route.request().postDataJSON() as { p_operation_id: string }).p_operation_id)
    // The first request never reaches the database.
    if (operationIds.length === 1) await route.abort("failed")
    else await route.continue()
  })
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Programar Servicio", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Programar Servicio", exact: true })
  await dialog.getByLabel("Tipo de Servicio", { exact: false }).click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByLabel("Kilometraje Programado").fill("0")
  await dialog.getByRole("button", { name: "Programar Servicio", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  await expect(dialog.getByLabel("Kilometraje Programado")).toBeDisabled()
  // Nothing reached the database, so a status query can never resolve it.
  await dialog.getByRole("button", { name: "Comprobar resultado", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Comprobar resultado", exact: true })).toBeEnabled()
  await expect(dialog.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  expect(operationIds).toHaveLength(1)
  await dialog.getByRole("button", { name: "Reintentar misma operación", exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(operationIds).toEqual([operationIds[0], operationIds[0]])
  expect((await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).schedules).toHaveLength(
    1
  )
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Programar Servicio", exact: true }).click()
  await expect(dialog.getByLabel("Kilometraje Programado")).toHaveValue("")
  await expect(dialog.getByRole("alert")).toHaveCount(0)
})

test("a rejected CRUD replay returns its editor to editing with the draft and the rejection inline", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  const read = async () =>
    (await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).schedules as unknown[]
  const before = (await read()).length
  await loginWithPassword(page, "/vehicles/00000000-0000-4000-8000-000000000093/maintenance")
  const operationIds: string[] = []
  await page.route("**/rest/v1/rpc/mutate_data", async (route) => {
    operationIds.push((route.request().postDataJSON() as { p_operation_id: string }).p_operation_id)
    // The first request never reaches the database; the replay is rejected by it.
    if (operationIds.length === 1) await route.abort("failed")
    else await route.fulfill({ status: 400, json: { code: "P0001", message: "Controlled rejection" } })
  })
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Programar Servicio", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Programar Servicio", exact: true })
  await dialog.getByLabel("Tipo de Servicio", { exact: false }).click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByLabel("Kilometraje Programado").fill("4321")
  await dialog.getByRole("button", { name: "Programar Servicio", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  const reference = await dialog.getByText("Referencia:", { exact: false }).textContent()
  if (!reference) throw new Error("Missing unresolved operation reference")

  await dialog.getByRole("button", { name: "Reintentar misma operación", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("No se realizó la operación")
  await expect(dialog).toBeVisible()
  // The owning editor reports the rejection inline only; the embedded recovery card does not toast it.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0)
  await expect(dialog.getByLabel("Kilometraje Programado")).toHaveValue("4321")
  await expect(dialog.getByLabel("Kilometraje Programado")).toBeEnabled()
  // The rejected operation left the recovery list.
  await expect(page.getByText(reference, { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole("button", { name: "Reintentar misma operación", exact: true })).toHaveCount(0)
  expect(operationIds).toEqual([operationIds[0], operationIds[0]])
  expect(await read()).toHaveLength(before)
})

test("a rejected CRUD replay from the standalone recovery panel is explained by a toast", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, "/vehicles/00000000-0000-4000-8000-000000000093/maintenance")
  const operationIds: string[] = []
  await page.route("**/rest/v1/rpc/mutate_data", async (route) => {
    operationIds.push((route.request().postDataJSON() as { p_operation_id: string }).p_operation_id)
    // The first request never reaches the database; the replay is rejected by it.
    if (operationIds.length === 1) await route.abort("failed")
    else await route.fulfill({ status: 400, json: { code: "P0001", message: "Controlled rejection" } })
  })
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Programar Servicio", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Programar Servicio", exact: true })
  await dialog.getByLabel("Tipo de Servicio", { exact: false }).click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByLabel("Kilometraje Programado").fill("4321")
  await dialog.getByRole("button", { name: "Programar Servicio", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  const reference = await dialog.getByText("Referencia:", { exact: false }).textContent()
  if (!reference) throw new Error("Missing unresolved operation reference")

  // After a reload no editor owns the operation; only the page's recovery panel lists it.
  await page.reload()
  await expect(page.getByText(reference, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Reintentar misma operación", exact: true }).click()
  await expect(page.getByText(reference, { exact: true })).toHaveCount(0)
  const toast = page.locator("[data-sonner-toast]")
  await expect(toast).toHaveCount(1)
  await expect(toast).toContainText("No se realizó la operación")
  expect(operationIds).toEqual([operationIds[0], operationIds[0]])
})

test("maintenance editing preserves zero and NULL, then deletion updates the owned history", async ({
  page,
  request,
}) => {
  const vehicleId = "00000000-0000-4000-8000-000000000093"
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: {
      maintenance: true,
      records: [
        {
          id: "00000000-0000-4000-8000-000000000095",
          vehicle_id: vehicleId,
          user_id: "00000000-0000-4000-8000-000000000051",
          type: "other",
          description: "Before edit",
          notes: "Before note",
          cost: 42,
          mileage: 100,
          service_date: "2026-01-01",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    },
  })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await page.getByRole("button", { name: "Acciones del mantenimiento Otro" }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar Registro de Mantenimiento", exact: true })
  await dialog.getByLabel("Descripción", { exact: true }).fill("")
  await dialog.getByLabel("Costo (€)", { exact: true }).fill("0")
  await dialog.getByLabel("Kilometraje", { exact: true }).fill("0")
  await dialog.getByLabel("Notas Adicionales", { exact: true }).fill("")
  await dialog.getByRole("button", { name: "Actualizar Mantenimiento", exact: true }).click()
  await expect(dialog).toBeHidden()
  const saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  expect(saved.records[0]).toMatchObject({ description: null, notes: null, cost: 0, mileage: 0 })
  await expect(page.getByText("0 km", { exact: true })).toHaveCount(2) // vehicle header and history
  await page.getByRole("button", { name: "Acciones del mantenimiento Otro" }).click()
  await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click()
  const confirmation = page.getByRole("dialog", { name: "Eliminar Registro de Mantenimiento", exact: true })
  const response = page.waitForResponse("**/rest/v1/rpc/mutate_data")
  await confirmation.getByRole("button", { name: "Eliminar Registro", exact: true }).click()
  await response
  await expect(page.getByText("No hay registros de mantenimiento", { exact: true })).toBeVisible()
  expect((await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).records).toEqual([])
})

for (const kind of ["vehicle", "maintenance"] as const) {
  test(`a rejected deletion of the last ${kind} keeps its confirmation and error visible`, async ({
    page,
    request,
  }) => {
    const vehicleId = "00000000-0000-4000-8000-000000000093"
    await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
      data: {
        maintenance: true,
        records:
          kind === "maintenance"
            ? [
                {
                  id: "00000000-0000-4000-8000-000000000095",
                  vehicle_id: vehicleId,
                  user_id: "00000000-0000-4000-8000-000000000051",
                  type: "other",
                  description: "Retained record",
                  notes: null,
                  cost: 0,
                  mileage: 0,
                  service_date: "2026-01-01",
                  created_at: "2026-01-01T00:00:00Z",
                  updated_at: "2026-01-01T00:00:00Z",
                },
              ]
            : [],
      },
    })
    await loginWithPassword(page, kind === "vehicle" ? "/vehicles" : `/vehicles/${vehicleId}/maintenance`)
    await page.route("**/rest/v1/rpc/mutate_data", (route) =>
      route.fulfill({ status: 400, json: { code: "P0001", message: "No affected row" } })
    )
    await page
      .getByRole("button", {
        name: kind === "vehicle" ? "Acciones de Synthetic Maintenance" : "Acciones del mantenimiento Otro",
      })
      .click()
    await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click()
    const dialog = page.getByRole("dialog", {
      name: kind === "vehicle" ? "Eliminar Vehículo" : "Eliminar Registro de Mantenimiento",
      exact: true,
    })
    await dialog
      .getByRole("button", { name: kind === "vehicle" ? "Eliminar Vehículo" : "Eliminar Registro", exact: true })
      .click()
    await expect(dialog.getByRole("alert")).toContainText("No se realizó la operación")
    await expect(
      dialog.getByRole("button", { name: kind === "vehicle" ? "Eliminar Vehículo" : "Eliminar Registro", exact: true })
    ).toBeEnabled()
  })
}

test("the first vehicle create keeps its editor and immutable payload while its response is unknown", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true, emptyVehicles: true } })
  await loginWithPassword(page, "/vehicles")
  // The consent banner overlays the empty-state action until a choice is made.
  await page.getByRole("button", { name: "Rechazar analítica" }).click()
  await page.getByRole("button", { name: "Agregar Mi Primer Vehículo", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Nuevo Vehículo", exact: true })
  await dialog.getByLabel("Marca", { exact: false }).fill("First")
  await dialog.getByLabel("Modelo", { exact: false }).fill("Unknown")
  await dialog.getByLabel("Año", { exact: false }).click()
  await page.getByRole("option", { name: String(new Date().getFullYear()), exact: true }).click()
  await dialog.getByLabel("Kilometraje Actual", { exact: true }).fill("0")
  let attempts = 0
  await page.route("**/rest/v1/rpc/mutate_data", async (route) => {
    attempts++
    await route.fetch()
    await route.fulfill({ status: 503, json: { message: "Lost response" } })
  })
  await dialog.getByRole("button", { name: "Agregar Vehículo", exact: true }).click()
  await expect(dialog.getByRole("status")).toContainText("Resultado pendiente de confirmar")
  await expect(dialog.getByLabel("Marca", { exact: false })).toBeDisabled()
  await expect(dialog.getByLabel("Marca", { exact: false })).toHaveValue("First")
  await dialog.getByRole("button", { name: "Comprobar resultado", exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("First Unknown", { exact: true })).toBeVisible()
  expect(attempts).toBe(1)
})
