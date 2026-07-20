import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const projectRoot = process.cwd()
const sourceRoots = ["app", "components", "contexts", "hooks", "lib"]

function collectTypeScriptSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      return collectTypeScriptSources(path)
    }

    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [path] : []
  })
}

function readApplicationSources() {
  return sourceRoots.flatMap((root) => collectTypeScriptSources(join(projectRoot, root)))
}

describe("client authentication contract", () => {
  it("retires the legacy browser authentication entry points", () => {
    const retiredPaths = [
      "app/api/auth/signout/route.ts",
      "contexts/AuthContext.tsx",
      "hooks/useAuth.ts",
      "hooks/useDashboardData.tsx",
      "hooks/useSupabase.ts",
      "lib/auth/authManager.ts",
    ]

    expect(retiredPaths.filter((path) => existsSync(join(projectRoot, path)))).toEqual([])
  })

  it("keeps a single browser client without application-owned session cleanup", () => {
    const browserClientOwners = readApplicationSources()
      .filter((path) => readFileSync(path, "utf8").includes("createBrowserClient"))
      .map((path) => relative(projectRoot, path))

    expect(browserClientOwners).toEqual(["lib/supabase/client.ts"])

    const browserClientSource = readFileSync(join(projectRoot, "lib/supabase/client.ts"), "utf8")
    expect(browserClientSource).not.toMatch(/document\.cookie|localStorage|sessionStorage|cookies\s*:/)
  })

  it("has no client caller for the retired sign-out endpoint", () => {
    const callers = readApplicationSources()
      .filter((path) => readFileSync(path, "utf8").includes("/api/auth/signout"))
      .map((path) => relative(projectRoot, path))

    expect(callers).toEqual([])
  })
})
