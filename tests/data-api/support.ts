import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

export const PROJECT_ID = "keepel-issue90-ticket91"
export const ROOT = realpathSync(fileURLToPath(new URL("../../", import.meta.url)))
const CONTAINER = `supabase_db_${PROJECT_ID}`
const API_URL = "http://127.0.0.1:57431"
const SCRIPTS = [
  "001_create_tables.sql",
  "002_create_profile_trigger.sql",
  "003_maintenance_function.sql",
  "004_create_scheduled_services.sql",
  "005_migrate_next_service_to_scheduled.sql",
  "006_drop_next_service_columns.sql",
  "007_transactional_maintenance.sql",
  "008_confirmed_data_mutations.sql",
  "009_history_pages_and_totals.sql",
  "010_scheduled_service_criterion.sql",
]

export function assertLocalProject() {
  const config = readFileSync(`${ROOT}/supabase/config.toml`, "utf8")
  if (
    !config.split("\n").includes(`project_id = "${PROJECT_ID}"`) ||
    !config.includes("port = 57431") ||
    !config.includes("port = 57432") ||
    existsSync(`${ROOT}/supabase/.temp/project-ref`)
  ) {
    throw new Error("Refusing non-test or linked Supabase project")
  }
  if (process.env.KEEPEL_DATA_API_TEST !== "1") {
    throw new Error("Use bun run test:data-api; local database operations require the test guard")
  }
}

export function cli(args: string[]) {
  assertLocalProject()
  // Capture CLI status (including local credentials), never log it.
  return execFileSync("supabase", [...args, "--workdir", ROOT], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  })
}

export function localConnection() {
  const ownerPath = `${ROOT}/supabase/.temp/issue91-owner`
  if (!existsSync(ownerPath) || readFileSync(ownerPath, "utf8") !== ROOT) {
    throw new Error("The disposable stack is not owned by this checkout")
  }
  const status = JSON.parse(cli(["status", "--output", "json"]))
  if (
    status.API_URL !== API_URL ||
    new URL(status.DB_URL).host !== "127.0.0.1:57432" ||
    typeof status.ANON_KEY !== "string"
  ) {
    throw new Error("Refusing an unexpected Data API endpoint")
  }
  return { url: API_URL, anonKey: status.ANON_KEY as string }
}

export function executeLocalSql(sql: string) {
  localConnection()
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "--single-transaction",
    ],
    {
      input: sql,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }
  )
}

export function replayScript(number: number) {
  const name = SCRIPTS[number - 1]
  if (!name) throw new Error("Unknown legacy script")
  executeLocalSql(readFileSync(`${ROOT}/scripts/${name}`, "utf8"))
  executeLocalSql("NOTIFY pgrst, 'reload schema';")
}

export function prepareDatabase(through = 10) {
  localConnection()
  cli(["db", "reset", "--local", "--no-seed", "--yes"])
  for (let number = 1; number <= through; number++) replayScript(number)
}

export function ordinaryClient(fetcher?: typeof fetch) {
  const { url, anonKey } = localConnection()
  return createClient(url, anonKey, {
    global: fetcher ? { fetch: fetcher } : undefined,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export async function createAccount(label: string, fetcher?: typeof fetch) {
  const client = ordinaryClient(fetcher)
  const { data, error } = await client.auth.signUp({
    email: `issue91-${label}-${randomUUID()}@example.test`,
    password: `Local-only-${randomUUID()}`,
  })
  if (error || !data.user || !data.session) throw new Error("Synthetic local signup failed")
  return { client, id: data.user.id }
}
