import { expect, test, type Page } from "@playwright/test"
import { loginWithPassword } from "./support/auth"
import { CONTROLLED_SERVICES_URL } from "./support/controlled-services-config"

const vehicleId = "00000000-0000-4000-8000-000000000093"
const historyPath = `/vehicles/${vehicleId}/maintenance`

function shellNavigation(page: Page) {
  return page.getByRole("navigation", { name: "Navegación principal" })
}

async function rejectAnalytics(page: Page) {
  await page.getByRole("button", { name: "Rechazar analítica" }).click()
  await expect(page.getByRole("region", { name: "Preferencias de privacidad" })).toBeHidden()
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

test.beforeEach(async ({ request }) => {
  await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: { maintenance: true } })
})

test("public and guest surfaces stay outside the authenticated shell", async ({ page }) => {
  for (const path of ["/", "/auth/login", "/auth/signup", "/privacidad"]) {
    await page.goto(path)
    await expect(page.getByRole("contentinfo")).toBeVisible()
    await expect(shellNavigation(page)).toHaveCount(0)
  }
})

test("the shell persists across private views and Privacy with the rail preference", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await loginWithPassword(page)
  await rejectAnalytics(page)

  await expect(page.getByRole("heading", { name: "Panel de Control" })).toBeVisible()
  await expect(shellNavigation(page).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("main")).toHaveCount(1)
  await expect(page.getByRole("contentinfo")).toHaveCount(0)

  await page.getByRole("button", { name: "Expandir navegación" }).click()
  await expect(page.getByRole("button", { name: "Contraer navegación" })).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByText("Hola, Ada Driver", { exact: true })).toBeVisible()

  await shellNavigation(page).getByRole("link", { name: "Vehículos" }).click()
  await expect(page).toHaveURL(/\/vehicles$/)
  await expect(page.getByRole("heading", { name: "Mis Vehículos" })).toBeVisible()
  await expect(shellNavigation(page).getByRole("link", { name: "Vehículos" })).toHaveAttribute("aria-current", "page")
  await expect(shellNavigation(page).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current")
  await expect(page.getByRole("button", { name: "Contraer navegación" })).toBeVisible()

  await page.getByRole("link", { name: "Ver Mantenimientos" }).click()
  await expect(page).toHaveURL(historyPath)
  await expect(page.getByRole("heading", { name: "Historial de Mantenimiento" })).toBeVisible()
  await expect(shellNavigation(page).getByRole("link", { name: "Vehículos" })).toHaveAttribute("aria-current", "page")

  await page.reload()
  await expect(page.getByRole("heading", { name: "Historial de Mantenimiento" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Contraer navegación" })).toBeVisible()

  await page.getByRole("link", { name: "Privacidad", exact: true }).click()
  await expect(page).toHaveURL(/\/privacidad$/)
  await expect(page.getByRole("heading", { level: 1, name: "Política de Privacidad y Cookies" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Privacidad", exact: true })).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("main")).toHaveCount(1)
  await expect(page.getByRole("contentinfo")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Contraer navegación" })).toBeVisible()

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await shellNavigation(page).getByRole("link", { name: "Dashboard" }).click()
  await expect(page.getByRole("heading", { name: "Panel de Control" })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test("a private view keeps the shell while its data loads", async ({ page }) => {
  await loginWithPassword(page)
  let releaseVehicles!: () => void
  const vehiclesHeld = new Promise<void>((resolve) => {
    releaseVehicles = resolve
  })
  await page.route("**/rest/v1/vehicles?**", async (route) => {
    await vehiclesHeld
    await route.continue()
  })

  await page.goto("/vehicles")
  const loading = page.getByRole("status", { name: "Cargando vehículos" })
  await expect(loading).toBeVisible()
  await expect(page.getByRole("main").getByRole("status", { name: "Cargando vehículos" })).toBeVisible()
  await expect(shellNavigation(page)).toBeVisible()

  releaseVehicles()
  await expect(page.getByText("Synthetic Maintenance", { exact: true })).toBeVisible()
  await expect(shellNavigation(page)).toBeVisible()
})

test("external session loss on Privacy keeps the policy in its public layout", async ({ page, context }) => {
  await loginWithPassword(page)
  await page.goto("/privacidad")
  await expect(shellNavigation(page)).toBeVisible()

  await context.clearCookies()
  const otherTab = await context.newPage()
  await otherTab.goto("/auth/login")
  await otherTab.evaluate(() => {
    const channel = new BroadcastChannel("keepel-auth-invalidation")
    // eslint-disable-next-line unicorn/require-post-message-target-origin
    channel.postMessage({ type: "auth-invalidated" })
    channel.close()
  })

  await expect(shellNavigation(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/privacidad$/)
  await expect(page.getByRole("heading", { level: 1, name: "Política de Privacidad y Cookies" })).toBeVisible()
  await expect(page.getByRole("contentinfo")).toBeVisible()
})

test("logging out from Privacy returns to login", async ({ page }) => {
  await loginWithPassword(page, "/privacidad")
  await rejectAnalytics(page)
  await page.getByRole("button", { name: "Cerrar sesión" }).click()
  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(shellNavigation(page)).toHaveCount(0)
})

test.describe("phone width with touch", () => {
  test.use({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true })

  test("the navigation drawer is modal, closes on navigation and hands off to cookie preferences", async ({ page }) => {
    await loginWithPassword(page)
    await page.getByRole("button", { name: "Rechazar analítica" }).tap()
    expect(await horizontalOverflow(page)).toBe(0)

    const trigger = page.getByRole("button", { name: "Abrir navegación" })
    await trigger.tap()
    const drawer = page.getByRole("dialog", { name: "Navegación de Keepel" })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText("Hola, Ada Driver", { exact: true })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()
    await expect(trigger).toBeFocused()

    await trigger.tap()
    await drawer.getByRole("link", { name: "Vehículos" }).tap()
    await expect(page).toHaveURL(/\/vehicles$/)
    await expect(drawer).toBeHidden()
    await expect(page.getByRole("heading", { name: "Mis Vehículos" })).toBeVisible()
    expect(await horizontalOverflow(page)).toBe(0)

    await page.goto("/privacidad")
    expect(await horizontalOverflow(page)).toBe(0)
    await trigger.tap()
    await drawer.getByRole("button", { name: "Configurar cookies" }).tap()
    await expect(page.getByRole("heading", { name: "Preferencias de privacidad" })).toBeVisible()
    await expect(drawer).toBeHidden()
    await expect(page.getByRole("dialog")).toHaveCount(1)
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("heading", { name: "Preferencias de privacidad" })).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})
