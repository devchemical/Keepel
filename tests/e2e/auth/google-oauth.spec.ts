import { expect, test } from "@playwright/test"
import { resetControlledServices } from "../support/controlled-services-config"

test("Google OAuth returns through the PKCE callback to authenticated UI", async ({ page, request }) => {
  await resetControlledServices(request, "success")
  await page.goto("/auth/login?redirect=%2Fvehicles")

  await page.getByRole("link", { name: "Continuar con Google" }).click()

  await expect(page).toHaveURL(/\/vehicles$/)
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible()
  await expect(page.getByText("Hola, Ada Driver", { exact: true })).toBeAttached()
  expect(page.url()).not.toContain("code=")
  expect(page.url()).not.toContain("access_token")
})

test("Google OAuth cancellation maps to a stable public error", async ({ page, request }) => {
  await resetControlledServices(request, "cancel")
  await page.goto("/auth/login")

  await page.getByRole("link", { name: "Continuar con Google" }).click()

  await expect(page).toHaveURL(/\/auth\/error\?error=oauth_cancelled$/)
  await expect(
    page.getByText("Cancelaste el inicio de sesión con Google. Puedes intentarlo de nuevo cuando quieras.", {
      exact: true,
    })
  ).toBeVisible()
  await expect(page.getByText(/oauth_cancelled/)).toHaveCount(0)
  await expect(page.getByText(/controlled provider description/i)).toHaveCount(0)
})

test("Google OAuth exchange failures hide provider details", async ({ page, request }) => {
  await resetControlledServices(request, "exchange_error")
  await page.goto("/auth/login")

  await page.getByRole("link", { name: "Continuar con Google" }).click()

  await expect(page).toHaveURL(/\/auth\/error\?error=provider_error$/)
  await expect(
    page.getByText("Google no pudo completar el inicio de sesión. Inténtalo de nuevo.", { exact: true })
  ).toBeVisible()
  await expect(page.getByText(/provider_error/)).toHaveCount(0)
  expect(page.url()).not.toContain("controlled-provider-secret")
  await expect(page.getByText(/controlled-provider-secret/i)).toHaveCount(0)
})

test("Unknown OAuth error values show the generic message without echoing the value", async ({ page }) => {
  await page.goto("/auth/error?error=%3Cb%3Einjected-value%3C%2Fb%3E")

  await expect(
    page.getByText("Ocurrió un error no especificado durante la autenticación.", { exact: true })
  ).toBeVisible()
  await expect(page.getByText(/injected-value/)).toHaveCount(0)
})

test("Google sign-in button clears its spinner when the page is shown again", async ({ page, request }) => {
  await resetControlledServices(request, "success")
  await page.goto("/auth/login")
  // Cancel the link's default navigation after React handles the click, so the loading state can be observed.
  await page.evaluate(() => window.addEventListener("click", (event) => event.preventDefault()))

  const googleLink = page.getByRole("link", { name: "Continuar con Google" })
  await googleLink.click()
  await expect(googleLink).toHaveAttribute("aria-busy", "true")

  // A back/forward cache restore fires `pageshow` with `persisted: true` on the kept document.
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })))

  await expect(googleLink).toHaveAttribute("aria-busy", "false")
})
