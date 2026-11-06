import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test"
import { CONTROLLED_SERVICES_URL } from "../support/controlled-services-config"

const ONE_DAY_SECONDS = 60 * 60 * 24

function collectBrowserAnalyticsRequests(page: Page) {
  const requests: string[] = []

  page.on("request", (request) => {
    if (request.url().includes("openpanel")) {
      requests.push(request.url())
    }
  })

  return requests
}

async function expectPersistedConsentCookie(context: BrowserContext) {
  const cookie = (await context.cookies()).find((candidate) => candidate.name === "keepel_privacy_consent")

  expect(cookie).toMatchObject({ httpOnly: true, path: "/", sameSite: "Lax", secure: false })
  expect(cookie?.expires).toBeGreaterThan(Date.now() / 1000 + 364 * ONE_DAY_SECONDS)
  expect(cookie?.expires).toBeLessThanOrEqual(Date.now() / 1000 + 366 * ONE_DAY_SECONDS)
}

async function loginWithEmail(page: Page) {
  await page.goto("/auth/login")
  await page.getByLabel("Email").fill("driver@keepel.test")
  await page.getByLabel("Contraseña").fill("correct-horse")
  await page.getByRole("button", { name: "Iniciar Sesión", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function readAnalyticsEvents(request: APIRequestContext) {
  const response = await request.get(`${CONTROLLED_SERVICES_URL}/__test__/analytics`)
  const body = (await response.json()) as { events: unknown[] }

  return body.events
}

const consentJourneys = [
  {
    choice: "accepts" as const,
    buttonName: "Aceptar analítica",
    expectedEvents: [{ type: "track", payload: { name: "auth_login_email_succeeded" } }],
  },
  {
    choice: "rejects" as const,
    buttonName: "Rechazar analítica",
    expectedEvents: [],
  },
]

test.describe("privacy and cookies", () => {
  test("publishes the combined policy and global privacy controls", async ({ page }) => {
    await page.goto("/privacidad")

    await expect(page).toHaveTitle(/Política de Privacidad y Cookies/)
    await expect(page.getByRole("heading", { level: 1, name: "Política de Privacidad y Cookies" })).toHaveCount(1)
    await expect(page.getByText("Alejandro Bayón Burgos")).toBeVisible()
    await expect(page.getByRole("link", { name: "privacidad@keepel.dev" }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: "Privacidad y cookies", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Configurar cookies" })).toBeVisible()
  })

  for (const journey of consentJourneys) {
    test(`${journey.choice} optional analytics and persists the choice after reload`, async ({
      context,
      page,
      request,
    }) => {
      await request.post(`${CONTROLLED_SERVICES_URL}/__test__/reset`, { data: {} })
      const browserAnalyticsRequests = collectBrowserAnalyticsRequests(page)

      await page.goto("/")

      const accept = page.getByRole("button", { name: "Aceptar analítica" })
      const reject = page.getByRole("button", { name: "Rechazar analítica" })
      await expect(accept).toBeVisible()
      await expect(reject).toBeVisible()

      await page.getByRole("button", { name: journey.buttonName }).click()
      await expect(accept).toBeHidden()
      await expect(reject).toBeHidden()
      await expectPersistedConsentCookie(context)

      await page.reload()
      await expect(accept).toBeHidden()
      await expect(reject).toBeHidden()

      await loginWithEmail(page)

      if (journey.expectedEvents.length > 0) {
        await expect.poll(() => readAnalyticsEvents(request)).toEqual(journey.expectedEvents)
      } else {
        await page.waitForTimeout(500)
        expect(await readAnalyticsEvents(request)).toEqual([])
      }

      expect(browserAnalyticsRequests).toEqual([])
    })
  }

  test("allows changing privacy preferences from the global control", async ({ page }) => {
    await page.goto("/")
    let releaseSave!: () => void
    let capturedSave!: () => void
    const saveCaptured = new Promise<void>((resolve) => {
      capturedSave = resolve
    })
    const saveReleased = new Promise<void>((resolve) => {
      releaseSave = resolve
    })
    await page.route("**/*", async (route) => {
      if (!route.request().headers()["next-action"]) return route.continue()
      const response = await route.fetch()
      capturedSave()
      await saveReleased
      await route.fulfill({ response })
    })
    await page.getByRole("button", { name: "Rechazar analítica" }).click()
    await saveCaptured

    await page.getByRole("button", { name: "Configurar cookies" }).click()
    await expect(page.getByRole("heading", { name: "Preferencias de privacidad" })).toBeVisible()
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true)
    releaseSave()
    await expect(page.getByRole("button", { name: "Permitir analítica" })).toBeEnabled()
    await page.unroute("**/*")
    await page.getByRole("button", { name: "Permitir analítica" }).click()
    await expect(page.getByRole("heading", { name: "Preferencias de privacidad" })).toBeHidden()
  })

  test("shows an informational privacy notice at signup without a checkbox", async ({ page }) => {
    await page.goto("/auth/signup")

    await expect(page.getByText("Keepel está dirigido a personas mayores de 18 años.")).toBeVisible()
    await expect(
      page.locator("#main-content").getByRole("link", { name: "Política de Privacidad y Cookies" })
    ).toHaveAttribute("href", "/privacidad")
    await expect(page.getByRole("checkbox")).toHaveCount(0)
  })
})
