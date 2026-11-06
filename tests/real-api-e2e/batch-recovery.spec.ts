import { expect, test } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { spawn, execFileSync } from "node:child_process"
import { createClient } from "@supabase/supabase-js"
import { maintenanceReceiptSchema } from "../../lib/data/maintenance-command"
import type { Database } from "../../lib/supabase/database.types"

function executeLocalSql(sql: string) {
  return execFileSync(
    "bun",
    [
      "-e",
      'import {executeLocalSql} from "./tests/data-api/support.ts"; process.env.KEEPEL_DATA_API_TEST="1"; process.stdout.write(executeLocalSql(await Bun.stdin.text()))',
    ],
    { input: sql, encoding: "utf8" }
  )
}
const PROJECT_ID = "keepel-issue90-ticket91"

test("lost batch and lookup responses then reload during SQL retain one original batch and completion", async ({
  page,
}) => {
  const connection = JSON.parse(
    execFileSync(
      "bun",
      [
        "-e",
        'import {localConnection,prepareDatabase} from "./tests/data-api/support.ts"; process.env.KEEPEL_DATA_API_TEST="1"; prepareDatabase(); process.stdout.write(JSON.stringify(localConnection()))',
      ],
      { encoding: "utf8" }
    )
  )
  const client = createClient<Database>(connection.url, connection.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = `batch-reload-${randomUUID()}@example.test`
  const password = `Local-only-${randomUUID()}`
  const signup = await client.auth.signUp({ email, password })
  expect(signup.error).toBeNull()
  if (!signup.data.user) throw new Error("Missing synthetic account")
  const account = { client, id: signup.data.user.id }
  const vehicleId = randomUUID()
  const forecastId = randomUUID()
  expect(
    (
      await account.client
        .from("vehicles")
        .insert({ id: vehicleId, user_id: account.id, make: "Recovery", model: "SQL", year: 2026 })
    ).error
  ).toBeNull()
  expect(
    (
      await account.client.from("scheduled_services").insert({
        id: forecastId,
        user_id: account.id,
        vehicle_id: vehicleId,
        type: "oil_change",
        scheduled_date: "2026-01-01",
      })
    ).error
  ).toBeNull()
  // Hold the transaction at its first record insert, after ownership validation.
  executeLocalSql(
    `CREATE FUNCTION public.test_hold_batch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.vehicle_id = '${vehicleId}'::uuid THEN PERFORM pg_advisory_xact_lock(90090, 10); END IF; RETURN NEW; END $$; CREATE TRIGGER test_hold_batch BEFORE INSERT ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION public.test_hold_batch();`
  )
  const locker = spawn(
    "docker",
    [
      "exec",
      "-i",
      `supabase_db_${PROJECT_ID}`,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] }
  )
  const locked = new Promise<void>((resolve, reject) => {
    locker.stdout.on("data", (chunk) => {
      if (String(chunk).includes("lock-ready")) resolve()
    })
    locker.on("error", reject)
    locker.on("exit", (code) => {
      if (code) reject(new Error("Local lock fixture failed"))
    })
  })
  const released = new Promise<void>((resolve) => {
    locker.on("exit", () => resolve())
  })
  locker.stdin.write("SELECT pg_advisory_lock(90090, 10); SELECT 'lock-ready';\n")
  await locked
  let release = () => {
    locker.stdin.end("SELECT pg_advisory_unlock(90090, 10);\n\\q\n")
  }
  try {
    await page.goto(`/auth/login?redirect=/vehicles/${vehicleId}/maintenance`)
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Contraseña").fill(password)
    await page.getByRole("button", { name: "Iniciar Sesión", exact: true }).click()
    await expect(page.getByText("Recovery SQL", { exact: true })).toBeVisible()
    let operationId = ""
    let submitted: unknown
    let attempts = 0
    let upstream: Promise<unknown> | undefined
    await page.route("**/rest/v1/rpc/create_maintenance_batch", async (route) => {
      attempts++
      submitted = route.request().postDataJSON()
      operationId = route.request().postDataJSON().p_operation_id
      upstream = route.fetch()
      await route.fulfill({ status: 503, json: { message: "Lost submit response" } })
    })
    await page.route("**/rest/v1/rpc/get_maintenance_batch_operation", (route) =>
      route.fulfill({ status: 503, json: { message: "Lost lookup response" } })
    )
    await page.getByRole("button", { name: "Agregar Primer Mantenimiento" }).click()
    const dialog = page.getByRole("dialog", { name: "Agregar Mantenimiento" })
    await dialog.getByLabel("Fecha de Servicio", { exact: false }).fill("2026-03-08")
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click()
    await dialog.getByRole("combobox").nth(1).click()
    await page.getByRole("option", { name: "Otro", exact: true }).click()
    await dialog.getByPlaceholder("Marca, modelo...").nth(1).fill("Original SQL payload")
    await dialog.getByLabel("Resolver una previsión (opcional)").click()
    await page.getByRole("option", { name: "Cambio de Aceite · 2026-01-01", exact: true }).click()
    await dialog.getByRole("button", { name: "Agregar Mantenimiento", exact: true }).click()
    await expect(dialog.getByRole("alert")).toContainText("Resultado pendiente de confirmar")
    await expect
      .poll(() =>
        executeLocalSql(
          "SELECT count(*) FROM pg_stat_activity WHERE wait_event = 'advisory' AND query LIKE '%create_maintenance_batch%';"
        )
          .trim()
          .split("\n")
          .some((line) => line.trim() === "1")
      )
      .toBe(true)
    await page.reload()
    await expect(page.getByText(`Referencia: ${operationId}`, { exact: true })).toBeVisible()
    await page.unroute("**/rest/v1/rpc/get_maintenance_batch_operation")
    await page.getByRole("button", { name: "Comprobar resultado", exact: true }).click()
    await expect(page.getByText(`Referencia: ${operationId}`, { exact: true })).toBeVisible()
    expect((await account.client.from("maintenance_records").select("id")).data).toEqual([])
    release()
    release = () => {}
    await released
    await upstream
    await page.getByRole("button", { name: "Comprobar resultado", exact: true }).click()
    await expect(page.getByText(`Referencia: ${operationId}`, { exact: true })).toHaveCount(0)
    await expect(page.getByText("1 registro(s) de mantenimiento", { exact: true })).toBeVisible()
    expect(attempts).toBe(1)
    const receipt = await account.client.rpc("get_maintenance_batch_operation", { p_operation_id: operationId })
    expect(receipt.error).toBeNull()
    const saved = maintenanceReceiptSchema.parse(receipt.data)
    expect(saved.records).toHaveLength(1)
    expect(saved.records[0]).toMatchObject({ service_date: "2026-03-08", description: "Original SQL payload" })
    expect(saved.scheduled_service).toMatchObject({
      id: forecastId,
      status: "completed",
      completed_record_id: saved.records[0].id,
    })
    expect(submitted).toMatchObject({
      p_operation_id: operationId,
      p_today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      p_completion: { scheduled_service_id: forecastId, service_index: 0 },
    })
    expect((await account.client.from("maintenance_records").select()).data).toHaveLength(1)
  } finally {
    release()
    await released
    executeLocalSql(
      "DROP TRIGGER test_hold_batch ON public.maintenance_records; DROP FUNCTION public.test_hold_batch();"
    )
    await account.client.auth.signOut()
  }
})
