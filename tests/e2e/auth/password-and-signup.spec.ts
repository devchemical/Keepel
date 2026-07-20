import { expect, test } from "@playwright/test"
import { resetControlledServices } from "../support/controlled-services-config"

test.beforeEach(async ({ request }) => {
  await resetControlledServices(request)
})

test("a user can sign in with a password and continue to a protected route", async ({ page }) => {
  await page.goto("/auth/login?redirect=%2Fvehicles")
  await page.getByLabel("Email").fill("driver@keepel.test")
  await page.getByLabel("Contraseña").fill("correct-horse")
  await page.getByRole("button", { name: "Iniciar Sesión", exact: true }).click()

  await expect(page).toHaveURL(/\/vehicles$/)
  await expect(page.getByText("Hola, Ada Driver", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Mis Vehículos" })).toBeVisible()
})

test("invalid password credentials show stable user-facing feedback", async ({ page }) => {
  await page.goto("/auth/login")
  await page.getByLabel("Email").fill("driver@keepel.test")
  await page.getByLabel("Contraseña").fill("incorrect-password")
  await page.getByRole("button", { name: "Iniciar Sesión", exact: true }).click()

  await expect(page.getByText("El email o la contraseña no son correctos.", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/auth\/login$/)
})

test("signup requiring email confirmation leads to the confirmation instructions", async ({ page }) => {
  await page.goto("/auth/signup")
  await page.getByLabel("Nombre Completo").fill("Grace Mechanic")
  await page.getByLabel("Email").fill("grace@keepel.test")
  await page.getByLabel("Contraseña", { exact: true }).fill("correct-horse")
  await page.getByLabel("Confirmar Contraseña").fill("correct-horse")
  await page.getByRole("button", { name: "Crear Cuenta", exact: true }).click()

  await expect(page).toHaveURL(/\/auth\/signup-success$/)
  await expect(page.getByText("¡Cuenta Creada Exitosamente!", { exact: true })).toBeVisible()
  await expect(page.getByText("Verifica tu email para continuar", { exact: true })).toBeVisible()
})
