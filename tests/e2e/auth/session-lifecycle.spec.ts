import { expect, test } from "@playwright/test"
import { loginWithPassword } from "../support/auth"
import { resetControlledServices } from "../support/controlled-services-config"

test.beforeEach(async ({ request }) => {
  await resetControlledServices(request)
})

test("an authenticated user can log out", async ({ page }) => {
  await loginWithPassword(page)
  await expect(page.getByText("Hola, Ada Driver", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Abrir menú de usuario" }).click()
  await page.getByRole("menuitem", { name: "Cerrar Sesión" }).click()

  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(page.getByText("Hola, Ada Driver", { exact: true })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Iniciar Sesión" })).toBeVisible()
})

test("authenticated visitors are redirected away from guest-only routes", async ({ page }) => {
  await loginWithPassword(page)

  await page.goto("/auth/login?redirect=%2Fvehicles")

  await expect(page).toHaveURL(/\/vehicles$/)
  await expect(page.getByRole("heading", { name: "Mis Vehículos" })).toBeVisible()
})

test("guest-only redirects reject external destinations", async ({ page }) => {
  await loginWithPassword(page)

  await page.goto("/auth/login?redirect=https%3A%2F%2Fevil.example%2Fphish")

  await expect(page).toHaveURL("http://localhost:3100/")
  await expect(page.getByRole("heading", { name: "Panel de Control" })).toBeVisible()
})

test("an expired session returns the user to login with a safe return path", async ({ page, context }) => {
  await loginWithPassword(page, "/vehicles")
  await expect(page.getByText("Hola, Ada Driver", { exact: true })).toBeVisible()
  await context.clearCookies()

  await page.getByRole("button", { name: "Abrir menú de usuario" }).click()
  await page.getByRole("menuitem", { name: "Cerrar Sesión" }).click()

  await expect(page).toHaveURL(/\/auth\/login\?redirect=%2Fvehicles$/)
  await expect(page.getByText("Hola, Ada Driver", { exact: true })).toHaveCount(0)
})

test("logout in one tab revalidates the authenticated projection in another tab", async ({ page, context }) => {
  await loginWithPassword(page)
  const secondPage = await context.newPage()
  await secondPage.goto("/")
  await expect(secondPage.getByText("Hola, Ada Driver", { exact: true })).toBeVisible()

  await page.getByRole("button", { name: "Abrir menú de usuario" }).click()
  await page.getByRole("menuitem", { name: "Cerrar Sesión" }).click()

  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(secondPage.getByText("Hola, Ada Driver", { exact: true })).toHaveCount(0)
  await expect(secondPage.getByRole("banner").getByRole("link", { name: "Iniciar Sesión" })).toBeVisible()
})
