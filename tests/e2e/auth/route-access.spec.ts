import { expect, test } from "@playwright/test"
import { resetControlledServices } from "../support/controlled-services-config"

test.beforeEach(async ({ request }) => {
  await resetControlledServices(request)
})

test("anonymous visitors are redirected from protected routes to login", async ({ page }) => {
  await page.goto("/vehicles/vehicle-1?tab=maintenance")

  await expect(page.getByText("Iniciar Sesión", { exact: true }).last()).toBeVisible()

  const currentUrl = new URL(page.url())
  expect(currentUrl.pathname).toBe("/auth/login")
  expect(currentUrl.searchParams.get("redirect")).toBe("/vehicles/vehicle-1?tab=maintenance")
})
