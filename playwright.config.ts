import { defineConfig, devices } from "@playwright/test"
import { APP_URL, CONTROLLED_SERVICES_URL } from "./tests/e2e/support/controlled-services-config"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "bun tests/e2e/support/controlled-services.ts",
      url: `${CONTROLLED_SERVICES_URL}/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "bun run dev --hostname 127.0.0.1 --port 3100",
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: CONTROLLED_SERVICES_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
        NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL: `${APP_URL}/`,
        APP_BASE_URL: APP_URL,
        UPSTASH_REDIS_REST_URL: CONTROLLED_SERVICES_URL,
        UPSTASH_REDIS_REST_TOKEN: "e2e-redis-token",
        KEEPEL_RATE_LIMIT_HMAC_SECRET: "e2e-rate-limit-secret-that-is-long-enough",
        KEEPEL_CONSENT_SIGNING_SECRET: "e2e-consent-secret-that-is-long-enough",
        OPENPANEL_API_URL: CONTROLLED_SERVICES_URL,
        OPENPANEL_SERVER_CLIENT_ID: "e2e-openpanel-writer",
        OPENPANEL_SERVER_CLIENT_SECRET: "e2e-openpanel-secret",
      },
    },
  ],
})
