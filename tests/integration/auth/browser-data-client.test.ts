import { afterEach, describe, expect, it, vi } from "vitest"

class RecordingBroadcastChannel extends EventTarget {
  static instances: RecordingBroadcastChannel[] = []
  readonly messages: unknown[] = []
  closed = false

  constructor(readonly name: string) {
    super()
    RecordingBroadcastChannel.instances.push(this)
  }

  postMessage(message: unknown) {
    this.messages.push(message)
  }

  close() {
    this.closed = true
  }
}

describe("browser data client", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    RecordingBroadcastChannel.instances = []
  })

  it("closes Supabase's session channel before browser data access", async () => {
    vi.stubGlobal("BroadcastChannel", RecordingBroadcastChannel)
    vi.stubGlobal("window", globalThis)
    vi.stubGlobal("document", { cookie: "" })
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://keepel-test.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key")
    vi.resetModules()
    const { createClient } = await import("@/lib/supabase/client")

    createClient()
    await Promise.resolve()
    await Promise.resolve()

    expect(RecordingBroadcastChannel.instances).toHaveLength(1)
    expect(RecordingBroadcastChannel.instances[0]).toMatchObject({
      name: "sb-keepel-test-auth-token",
      closed: true,
      messages: [],
    })
  })
})
