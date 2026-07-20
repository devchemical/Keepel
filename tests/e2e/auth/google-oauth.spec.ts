import { expect, test } from "@playwright/test"
import { resetControlledServices } from "../support/controlled-services-config"

test("Google OAuth returns through the PKCE callback to authenticated UI", async ({ page, request }) => {
  await resetControlledServices(request, "success")
  await page.goto("/auth/login?redirect=%2Fvehicles")

  await page.getByRole("link", { name: "Continuar con Google" }).click()

  await expect(page).toHaveURL(/\/vehicles$/)
  await expect(page.getByRole("banner").getByText("Hola, Ada Driver", { exact: true })).toBeVisible()
  expect(page.url()).not.toContain("code=")
  expect(page.url()).not.toContain("access_token")
})

test("Google OAuth cancellation maps to a stable public error", async ({ page, request }) => {
  await resetControlledServices(request, "cancel")
  await page.goto("/auth/login")

  await page.getByRole("link", { name: "Continuar con Google" }).click()

  await expect(page).toHaveURL(/\/auth\/error\?error=oauth_cancelled$/)
  await expect(page.getByText("Código de error: oauth_cancelled", { exact: true })).toBeVisible()
  await expect(page.getByText(/controlled provider description/i)).toHaveCount(0)
})

test("Google OAuth exchange failures hide provider details", async ({ page, request }) => {
  await resetControlledServices(request, "exchange_error")
  await page.goto("/auth/login")

  await page.getByRole("link", { name: "Continuar con Google" }).click()

  await expect(page).toHaveURL(/\/auth\/error\?error=provider_error$/)
  await expect(page.getByText("Código de error: provider_error", { exact: true })).toBeVisible()
  expect(page.url()).not.toContain("controlled-provider-secret")
  await expect(page.getByText(/controlled-provider-secret/i)).toHaveCount(0)
})
