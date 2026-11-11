import { expect, test } from "@playwright/test"
import { loginWithPassword } from "./support/auth"
import { CONTROLLED_SERVICES_URL } from "./support/controlled-services-config"

const vehicleId = "00000000-0000-4000-8000-000000000093"

test("editing a forecast persists zero and actual NULL clears, and cancellation removes both reminders", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
    data: { maintenance: true, maintenanceSchedule: true },
  })
  await loginWithPassword(page)
  await page.getByRole("button", { name: "Acciones de Cambio de Aceite", exact: true }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Editar Servicio Programado" })
  await dialog.getByLabel("Fecha Programada").fill("")
  await dialog.getByLabel("Kilometraje Programado").fill("0")
  await dialog.getByRole("button", { name: "Guardar Cambios" }).click()
  await expect(dialog).toBeHidden()
  const saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  expect(saved.forecast).toMatchObject({ scheduled_date: null, scheduled_mileage: 0, description: null, notes: null })
  await expect(page.getByRole("listitem", { name: "Cambio de Aceite", exact: true })).toContainText("0 km")
  await page.getByRole("button", { name: "Acciones de Cambio de Aceite", exact: true }).click()
  await page.getByRole("menuitem", { name: "Cancelar previsión", exact: true }).click()
  await expect(page.getByRole("listitem", { name: "Cambio de Aceite", exact: true })).toHaveCount(0)
  await expect(page.getByText("No hay servicios programados", { exact: true })).toBeVisible()
  await expect(page.getByText("Próximos Servicios", { exact: true }).locator("../..")).toContainText("0")
  expect((await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).forecast.status).toBe(
    "cancelled"
  )
  await page.reload()
  await expect(page.getByText("No hay servicios programados", { exact: true })).toBeVisible()
})

for (const [timezoneId, today, yesterday, horizon, outside] of [
  ["America/Los_Angeles", "2026-11-04", "2026-11-03", "2026-12-04", "2026-12-05"],
  ["Pacific/Kiritimati", "2026-11-05", "2026-11-04", "2026-12-05", "2026-12-06"],
]) {
  test.describe(`reminders in ${timezoneId}`, () => {
    test.use({ timezoneId })
    test("dashboard counter and list share local days and mileage with explicit completion", async ({
      page,
      request,
    }) => {
      const schedule = (
        id: number,
        description: string,
        scheduled_date: string | null,
        scheduled_mileage: number | null,
        status = "pending"
      ) => ({
        id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
        vehicle_id: vehicleId,
        user_id: "00000000-0000-4000-8000-000000000051",
        type: "oil_change",
        description,
        scheduled_date,
        scheduled_mileage,
        status,
        notes: null,
        completed_record_id: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
      await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
        data: {
          maintenance: true,
          vehicleMileage: 100,
          schedules: [
            schedule(1, "Ayer", yesterday, null),
            schedule(2, "Hoy local", today, null),
            schedule(3, "Límite", horizon, null),
            schedule(4, "Fuera", outside, null),
            schedule(5, "Umbral", outside, 100),
            schedule(6, "Sin estimación", null, 101),
            schedule(7, "Cancelado", yesterday, null, "cancelled"),
            schedule(8, "Completado", yesterday, null, "completed"),
            schedule(9, "Sin odómetro previsto", null, null),
          ],
        },
      })
      await page.clock.setFixedTime(new Date("2026-11-05T01:00:00Z"))
      await loginWithPassword(page)
      const list = page.getByRole("list", { name: "Previsiones" })
      await expect(list.getByRole("listitem")).toHaveCount(4)
      await expect(page.getByText("Próximos Servicios", { exact: true }).locator("../..")).toContainText("4")
      await expect(list.getByRole("listitem", { name: "Ayer", exact: true })).toContainText("Vencido")
      await expect(list.getByRole("listitem", { name: "Hoy local", exact: true })).toContainText("Hoy")
      await expect(list.getByRole("listitem", { name: "Hoy local", exact: true })).not.toContainText("Vencido")
      await expect(list.getByRole("listitem", { name: "Límite", exact: true })).toContainText("30 días")
      await expect(list.getByRole("listitem", { name: "Umbral", exact: true })).toContainText("Vencido")
      await page.getByRole("button", { name: "Acciones de Ayer", exact: true }).click()
      await page.getByRole("menuitem", { name: "Completar previsión", exact: true }).click()
      const dialog = page.getByRole("dialog", { name: "Agregar Mantenimiento" })
      await expect(dialog.getByLabel("Resolver una previsión (opcional)")).toContainText(yesterday)
      await dialog.getByLabel("Fecha de Servicio", { exact: false }).fill(yesterday)
      await dialog.getByRole("combobox").first().click()
      await page.getByRole("option", { name: "Otro", exact: true }).click()
      await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
      await expect(dialog).toBeHidden()
      await expect(list.getByRole("listitem")).toHaveCount(3)
      await expect(page.getByText("Próximos Servicios", { exact: true }).locator("../..")).toContainText("3")
      const saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
      expect(saved.records[0]).toMatchObject({ type: "other", service_date: yesterday })
      expect(saved.schedules[0]).toMatchObject({ status: "completed", completed_record_id: saved.records[0].id })
      expect(saved.schedules[1].status).toBe("pending") // same type never implies completion
      await page.reload()
      await expect(page.getByRole("list", { name: "Previsiones" }).getByRole("listitem")).toHaveCount(3)
      await page.goto(`/vehicles/${vehicleId}/maintenance`)
      await expect(
        page
          .getByText(timezoneId === "America/Los_Angeles" ? "3 de noviembre de 2026" : "4 de noviembre de 2026", {
            exact: true,
          })
          .filter({ visible: true })
      ).toBeVisible()
    })
  })
}

test("creating and editing optional criteria validates the whole form and clears every optional field", async ({
  page,
  request,
}) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page, `/vehicles/${vehicleId}/maintenance`)
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("menuitem", { name: "Programar Servicio", exact: true }).click()
  let dialog = page.getByRole("dialog", { name: "Programar Servicio", exact: true })
  await dialog.getByLabel("Tipo de Servicio", { exact: false }).click()
  await page.getByRole("option", { name: "Otro", exact: true }).click()
  await dialog.getByRole("button", { name: "Programar Servicio", exact: true }).click()
  await expect(dialog.getByRole("alert")).toBeVisible()
  expect((await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()).schedules).toEqual([])
  await dialog.getByLabel("Kilometraje Programado").fill("0")
  await dialog.getByLabel("Descripción").fill("Criterios opcionales")
  await dialog.getByLabel("Notas", { exact: true }).fill("Una nota")
  await dialog.getByRole("button", { name: "Programar Servicio", exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.goto("/")
  await expect(page.getByRole("listitem", { name: "Criterios opcionales", exact: true })).toContainText("0 km")
  await page.getByRole("button", { name: "Acciones de Criterios opcionales", exact: true }).click()
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  dialog = page.getByRole("dialog", { name: "Editar Servicio Programado" })
  await dialog.getByLabel("Kilometraje Programado").fill("")
  await dialog.getByLabel("Fecha Programada").fill("2026-01-01")
  await dialog.getByLabel("Descripción").fill("")
  await dialog.getByLabel("Notas", { exact: true }).fill("")
  await dialog.getByRole("button", { name: "Guardar Cambios" }).click()
  await expect(dialog).toBeHidden()
  let saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  expect(saved.schedules[0]).toMatchObject({
    scheduled_mileage: null,
    scheduled_date: "2026-01-01",
    description: null,
    notes: null,
  })
  await page.getByRole("button", { name: "Acciones de Otro", exact: true }).focus()
  await page.keyboard.press("Enter")
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
  await dialog.getByLabel("Fecha Programada").fill("")
  await dialog.getByRole("button", { name: "Guardar Cambios" }).click()
  await expect(dialog.getByRole("alert")).toBeVisible()
  saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  expect(saved.schedules[0].scheduled_date).toBe("2026-01-01")
  await dialog.getByLabel("Kilometraje Programado").fill("0")
  await dialog.getByRole("button", { name: "Guardar Cambios" }).click()
  await expect(dialog).toBeHidden()
  saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
  expect(saved.schedules[0]).toMatchObject({ scheduled_mileage: 0, scheduled_date: null })
})

test.describe("later forecasts", () => {
  test.use({ timezoneId: "Europe/Madrid" })
  test("a forecast 60 days out and a mileage-only forecast are listed under Más adelante, cancellable and uncounted", async ({
    page,
    request,
  }) => {
    const schedule = (
      id: number,
      description: string,
      scheduled_date: string | null,
      scheduled_mileage: number | null
    ) => ({
      id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
      vehicle_id: vehicleId,
      user_id: "00000000-0000-4000-8000-000000000051",
      type: "oil_change",
      description,
      scheduled_date,
      scheduled_mileage,
      status: "pending",
      notes: null,
      completed_record_id: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    })
    await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
      data: {
        maintenance: true,
        vehicleMileage: 100,
        schedules: [
          schedule(1, "Por kilometraje", null, 15000),
          schedule(2, "En 60 días", "2027-01-04", null),
          schedule(3, "Próxima semana", "2026-11-10", null),
        ],
      },
    })
    await page.clock.setFixedTime(new Date("2026-11-05T10:00:00Z"))
    await loginWithPassword(page)
    const counter = page.getByText("Próximos Servicios", { exact: true }).locator("../..")
    const reminders = page.getByRole("list", { name: "Previsiones" })
    await expect(reminders.getByRole("listitem")).toHaveCount(1)
    await expect(counter).toContainText("1")

    const toggle = page.getByRole("button", { name: "Más adelante (2)" })
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
    const later = page.getByRole("list", { name: "Más adelante" })
    await expect(later).toHaveCount(0)
    await toggle.focus()
    await page.keyboard.press("Enter")
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(later.getByRole("listitem").nth(0)).toHaveAccessibleName("En 60 días")
    await expect(later.getByRole("listitem").nth(1)).toHaveAccessibleName("Por kilometraje")
    await expect(later.getByRole("listitem", { name: "Por kilometraje" })).toContainText("15.000 km")

    await later.getByRole("button", { name: "Acciones de En 60 días", exact: true }).click()
    await expect(page.getByRole("menuitem", { name: "Completar previsión", exact: true })).toHaveCount(0)
    await page.getByRole("menuitem", { name: "Cancelar previsión", exact: true }).click()
    await expect(later.getByRole("listitem", { name: "En 60 días" })).toHaveCount(0)
    await later.getByRole("button", { name: "Acciones de Por kilometraje", exact: true }).click()
    await page.getByRole("menuitem", { name: "Cancelar previsión", exact: true }).click()
    await expect(later).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Más adelante/ })).toHaveCount(0)
    await expect(reminders.getByRole("listitem")).toHaveCount(1)
    await expect(counter).toContainText("1")

    const saved = await (await request.get(`${CONTROLLED_SERVICES_URL}/__test__/maintenance`)).json()
    expect(saved.schedules.map((row: { status: string }) => row.status)).toEqual(["cancelled", "cancelled", "pending"])
  })
})
