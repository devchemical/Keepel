import { defineConfig, devices } from "@playwright/test"
import { execFileSync } from "node:child_process"

process.env.KEEPEL_DATA_API_TEST = "1"
// Capture local CLI credentials in memory; never log the child output.
const { url, anonKey } = JSON.parse(
  execFileSync(
    "bun",
    [
      "-e",
      'import {localConnection} from "./tests/data-api/support.ts"; process.env.KEEPEL_DATA_API_TEST="1"; process.stdout.write(JSON.stringify(localConnection()))',
    ],
    { encoding: "utf8" }
  )
)
export default defineConfig({
  testDir: "./tests/real-api-e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  reporter: "list",
  use: { baseURL: "http://localhost:3101", ...devices["Desktop Chrome"] },
  webServer: [
    {
      command: "bun tests/e2e/support/controlled-services.ts",
      url: "http://127.0.0.1:54321/health",
      reuseExistingServer: false,
    },
    {
      command: "bun run dev --hostname 127.0.0.1 --port 3101",
      url: "http://localhost:3101",
      reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
        APP_BASE_URL: "http://localhost:3101",
        UPSTASH_REDIS_REST_URL: "http://127.0.0.1:54321",
        UPSTASH_REDIS_REST_TOKEN: "e2e-redis-token",
        KEEPEL_RATE_LIMIT_HMAC_SECRET: "e2e-rate-limit-secret-that-is-long-enough",
        KEEPEL_CONSENT_SIGNING_SECRET: "e2e-consent-secret-that-is-long-enough",
        OPENPANEL_API_URL: "",
        OPENPANEL_SERVER_CLIENT_ID: "",
        OPENPANEL_SERVER_CLIENT_SECRET: "",
      },
    },
  ],
})
