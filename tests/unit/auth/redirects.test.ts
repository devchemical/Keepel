import { describe, expect, it } from "vitest"
import { sanitizeInternalRedirect } from "@/lib/auth/redirects"

describe("sanitizeInternalRedirect", () => {
  it.each(["/", "/vehicles", "/vehicles?status=due&sort=date", "/vehicles/vehicle-1/maintenance?status=due#record-42"])(
    "preserves the internal destination %s",
    (destination) => {
      expect(sanitizeInternalRedirect(destination)).toBe(destination)
    }
  )

  it.each([
    undefined,
    null,
    "",
    "   ",
    "vehicles",
    "https://evil.example/phishing",
    "https://keepel.chemicaldev.com/vehicles",
    "//evil.example/phishing",
    "///evil.example/phishing",
    "/\\evil.example/phishing",
    "javascript:alert(1)",
    "data:text/html,malicious",
    "vbscript:msgbox(1)",
    "/vehicles\u0000",
    "/vehicles\\maintenance",
    "/vehicles/%zz",
    " /vehicles",
  ])("uses the root fallback for unsafe destination %s", (destination) => {
    expect(sanitizeInternalRedirect(destination)).toBe("/")
  })
})
