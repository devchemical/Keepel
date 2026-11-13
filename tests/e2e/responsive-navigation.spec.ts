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

  test("authenticated screens fit a 320px viewport and the navigation drawer reaches a vehicle's history", async ({
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

    await page.getByRole("button", { name: "Abrir navegación" }).tap()
    await page.getByRole("dialog", { name: "Navegación de Keepel" }).getByRole("link", { name: "Vehículos" }).tap()
    await expect(page).toHaveURL(/\/vehicles$/)
    expect(await horizontalOverflow(page)).toBe(0)
    await page.getByRole("link", { name: "Ver Mantenimientos" }).tap()
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

test.describe("tablet width with touch", () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true })

  test("the compact rail replaces the drawer and navigates on tap", async ({ page, request }) => {
    await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
    await loginWithPassword(page)
    await expect(page.getByRole("button", { name: "Abrir navegación" })).toBeHidden()
    const navigation = page.getByRole("navigation", { name: "Navegación principal" })
    await navigation.getByRole("link", { name: "Vehículos" }).tap()
    await expect(page).toHaveURL(/\/vehicles$/)
    await expect(navigation.getByRole("link", { name: "Vehículos" })).toHaveAttribute("aria-current", "page")
    expect(await horizontalOverflow(page)).toBe(0)
  })
})
