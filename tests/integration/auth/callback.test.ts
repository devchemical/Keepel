import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { createAuthCallbackHandler } from "@/app/auth/callback/route"
import { createControlledAuthCallbackAdapter } from "@/tests/support/controlled-auth-callback-adapter"

describe("auth callback", () => {
  it("preserves a safe internal return destination", async () => {
    const adapter = createControlledAuthCallbackAdapter({
      data: { user: { id: "user-1" } },
      error: null,
    })
    const handleCallback = createAuthCallbackHandler(async () => adapter)
    const destination = "/vehicles/vehicle-1/maintenance?status=due#record-42"
    const request = new NextRequest(
      `https://keepel.example/auth/callback?code=valid-code&next=${encodeURIComponent(destination)}`
    )

    const response = await handleCallback(request)

    expect(response.headers.get("location")).toBe(`https://keepel.example${destination}`)
  })

  it("uses the application root when the return destination is external", async () => {
    const adapter = createControlledAuthCallbackAdapter({
      data: { user: { id: "user-1" } },
      error: null,
    })
    const handleCallback = createAuthCallbackHandler(async () => adapter)
    const request = new NextRequest(
      "https://keepel.example/auth/callback?code=valid-code&next=https%3A%2F%2Fevil.example%2Fphishing"
    )

    const response = await handleCallback(request)

    expect(response.headers.get("location")).toBe("https://keepel.example/")
  })

  it("maps provider cancellation to a stable browser-visible error", async () => {
    const handleCallback = createAuthCallbackHandler(async () => {
      throw new Error("the callback exchange must not run after provider cancellation")
    })
    const request = new NextRequest(
      "https://keepel.example/auth/callback?error=access_denied&error_description=Sensitive+provider+details"
    )

    const response = await handleCallback(request)

    expect(response.headers.get("location")).toBe("https://keepel.example/auth/error?error=oauth_cancelled")
    expect(response.headers.get("location")).not.toMatch(/access_denied|Sensitive|provider.details/i)
  })

  it("maps callback exchange failures to a stable browser-visible error", async () => {
    const adapter = createControlledAuthCallbackAdapter({
      data: null,
      error: { message: "Sensitive provider exchange details" },
    })
    const handleCallback = createAuthCallbackHandler(async () => adapter)
    const request = new NextRequest("https://keepel.example/auth/callback?code=invalid-code")

    const response = await handleCallback(request)

    expect(response.headers.get("location")).toBe("https://keepel.example/auth/error?error=provider_error")
    expect(response.headers.get("location")).not.toMatch(/Sensitive|exchange.details/i)
  })
})
