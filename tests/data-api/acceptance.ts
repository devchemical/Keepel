import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { cli, localConnection, prepareDatabase, ROOT } from "./support"

// Invoked under run.ts's checkout ownership guard and exclusive consumer lock.
if (process.argv[2] === "types") {
  prepareDatabase()
  const directory = mkdtempSync(join(tmpdir(), "keepel-schema-"))
  try {
    const generated = join(directory, "database.types.ts")
    writeFileSync(generated, cli(["gen", "types", "--local", "--schema", "public"]))
    const result = spawnSync("bun", ["x", "oxfmt", "--config", `${ROOT}/.oxfmtrc.json`, generated], {
      stdio: "inherit",
    })
    if (result.status !== 0) throw new Error("Could not format generated schema")
    if (readFileSync(generated, "utf8") !== readFileSync(`${ROOT}/lib/supabase/database.types.ts`, "utf8")) {
      throw new Error("Generated public schema differs from lib/supabase/database.types.ts")
    }
    process.stdout.write("Actual local schema001–009 matches checked-in public types\n")
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
} else if (process.argv[2] === "build") {
  const { url, anonKey } = localConnection()
  const result = spawnSync("bun", ["run", "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      APP_BASE_URL: "http://127.0.0.1:57435",
      UPSTASH_REDIS_REST_URL: "http://127.0.0.1:57436",
      UPSTASH_REDIS_REST_TOKEN: "local-build-placeholder",
      KEEPEL_RATE_LIMIT_HMAC_SECRET: "local-build-only-placeholder-value-97",
      KEEPEL_CONSENT_SIGNING_SECRET: "local-build-only-placeholder-value-97",
      OPENPANEL_API_URL: "",
      OPENPANEL_SERVER_CLIENT_ID: "",
      OPENPANEL_SERVER_CLIENT_SECRET: "",
    },
  })
  process.exitCode = result.status ?? 1
} else {
  throw new Error("Expected types or build")
}
