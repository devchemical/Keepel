import { spawnSync } from "node:child_process"
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { assertLocalProject, cli, PROJECT_ID, ROOT } from "./support"

process.env.KEEPEL_DATA_API_TEST = "1"
assertLocalProject()
const command = process.argv[2]
const ownerPath = `${ROOT}/supabase/.temp/issue91-owner`
const lockPath = `${ROOT}/supabase/.issue91-lock`
const descriptor = openSync(lockPath, "wx")
try {
  if (command === "start") {
    // An existing project must have been created by this checkout's harness.
    const existing = spawnSync("docker", ["inspect", `supabase_db_${PROJECT_ID}`], { stdio: "ignore" })
    if (existing.status === 0 && (!existsSync(ownerPath) || readFileSync(ownerPath, "utf8") !== ROOT)) {
      throw new Error("Project name already belongs to another checkout; refusing to touch it")
    }
    mkdirSync(`${ROOT}/supabase/.temp`, { recursive: true })
    // Retain ownership even if startup fails, so only this checkout can clean up a partial stack.
    writeFileSync(ownerPath, ROOT)
    cli([
      "start",
      "--exclude",
      "realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor",
    ])
    process.stdout.write(`Started disposable ${PROJECT_ID} at http://127.0.0.1:57431\n`)
  } else {
    if (!existsSync(ownerPath) || readFileSync(ownerPath, "utf8") !== ROOT) {
      throw new Error("Start this checkout's isolated stack first: bun run data-api:start")
    }
    if (command === "test") {
      const result = spawnSync(
        "bun",
        ["run", "test", "--", ...(process.argv.length > 3 ? process.argv.slice(3) : ["tests/data-api"])],
        {
          cwd: ROOT,
          env: process.env,
          stdio: "inherit",
        }
      )
      process.exitCode = result.status ?? 1
    } else if (command === "stop") {
      cli(["stop", "--no-backup"])
      unlinkSync(ownerPath)
      process.stdout.write(`Removed only the disposable ${PROJECT_ID} stack and its volumes\n`)
    } else {
      throw new Error("Expected start, test, or stop")
    }
  }
} finally {
  closeSync(descriptor)
  unlinkSync(lockPath)
}
