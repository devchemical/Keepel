import type { Page } from "@playwright/test"

export async function loginWithPassword(page: Page, redirectTo = "/") {
  const searchParams = new URLSearchParams({ redirect: redirectTo })
  await page.goto(`/auth/login?${searchParams.toString()}`)
  await page.getByLabel("Email").fill("driver@keepel.test")
  await page.getByLabel("Contraseña").fill("correct-horse")
  await page.getByRole("button", { name: "Iniciar Sesión", exact: true }).click()
  await page.getByText("Hola, Ada Driver", { exact: true }).waitFor()
}
