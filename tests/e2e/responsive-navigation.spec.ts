import { expect, test, type Page } from "@playwright/test"
import { loginWithPassword } from "./support/auth"
import { CONTROLLED_SERVICES_URL } from "./support/controlled-services-config"

const vehicleId = "00000000-0000-4000-8000-000000000093"
const historyPath = `/vehicles/${vehicleId}/maintenance`

/** The desktop greeting is hidden below `lg`, so phone-width tests wait for the dashboard instead. */
async function loginOnPhone(page: Page) {
  await page.goto("/auth/login")
  await page.getByLabel("Email").fill("driver@keepel.test")
  await page.getByLabel("Contraseña").fill("correct-horse")
  await page.getByRole("button", { name: "Iniciar Sesión", exact: true }).tap()
  await expect(page.getByRole("heading", { name: "Panel de Control" })).toBeVisible()
}

async function rejectAnalytics(page: Page) {
  await page.getByRole("button", { name: "Rechazar analítica" }).tap()
  await expect(page.getByRole("region", { name: "Preferencias de privacidad" })).toBeHidden()
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

test.describe("phone width with touch", () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true })

  test("authenticated screens fit a 320px viewport and the mobile menu opens a vehicle's history", async ({
    page,
    request,
  }) => {
    await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, {
      data: { maintenance: true, maintenanceSchedule: true, vehicleMileage: 168420 },
    })
    await loginOnPhone(page)
    await expect(page.getByText("Próximos Servicios", { exact: true })).toBeVisible()
    expect(await horizontalOverflow(page)).toBe(0)
    await rejectAnalytics(page)

    await page.goto(historyPath)
    await expect(page.getByText("No hay registros de mantenimiento", { exact: true })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Paginación del historial" })).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBe(0)

    await page.getByRole("button", { name: "Abrir menú" }).tap()
    await page
      .getByRole("dialog")
      .getByRole("link", { name: /Synthetic Maintenance/ })
      .tap()
    await expect(page).toHaveURL(historyPath)
    await expect(page.getByRole("heading", { name: "Historial de Mantenimiento" })).toBeVisible()
  })

  test("the dashboard vehicle row opens that vehicle's history", async ({ page, request }) => {
    await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
    await loginOnPhone(page)
    await rejectAnalytics(page)
    await page.getByRole("link", { name: /Synthetic Maintenance/ }).tap()
    await expect(page).toHaveURL(historyPath)
  })
})

test("the desktop Vehículo control opens its menu instead of navigating away", async ({ page, request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
  await loginWithPassword(page)
  await page.getByRole("button", { name: "Vehículo", exact: true }).click()
  const menu = page.getByRole("menu")
  await expect(menu).toBeVisible()
  await expect(page).toHaveURL("/")
  await menu.getByRole("menuitem", { name: /Synthetic Maintenance/ }).click()
  await expect(page).toHaveURL(historyPath)
})

test.describe("tablet width with touch", () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true })

  test("header menus stay open after a tap on their trigger", async ({ page, request }) => {
    await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
    await loginWithPassword(page)
    for (const [trigger, item] of [
      [
        page.getByRole("button", { name: "Abrir menú de usuario" }),
        page.getByRole("menuitem", { name: "Cerrar Sesión" }),
      ],
      [page.getByRole("button", { name: "Vehículo", exact: true }), page.getByRole("menuitem", { name: /Synthetic/ })],
    ] as const) {
      await trigger.tap()
      // The regression opened the menu for a frame and closed it on the tap's trailing click.
      await page.waitForTimeout(500)
      await expect(trigger).toHaveAttribute("aria-expanded", "true")
      await expect(item).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(trigger).toHaveAttribute("aria-expanded", "false")
    }
  })
})
