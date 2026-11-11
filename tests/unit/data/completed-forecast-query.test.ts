import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it } from "vitest"
import { readCompletedForecast } from "@/lib/data/queries"
import type { Database } from "@/lib/supabase/database.types"

const USER_ID = "00000000-0000-4000-8000-000000000051"
const RECORD_ID = "00000000-0000-4000-8000-000000000100"

/** Records the PostgREST builder calls and resolves with `result`. */
function clientResolving(result: { data: unknown; error: unknown }) {
  const calls: unknown[][] = []
  // A resolved promise stands in for the awaitable PostgREST builder.
  const builder = Object.assign(Promise.resolve(result), {})
  for (const method of ["from", "select", "eq", "limit", "abortSignal", "retry"]) {
    Object.assign(builder, {
      [method]: (...args: unknown[]) => {
        calls.push([method, ...args.filter((arg) => !(arg instanceof AbortSignal))])
        return builder
      },
    })
  }
  return { client: builder as unknown as SupabaseClient<Database>, calls }
}

describe("readCompletedForecast", () => {
  it("reads only the signed-in owner's forecast completed by the record", async () => {
    const forecast = { type: "oil_change", scheduled_date: "2026-01-01" }
    const { client, calls } = clientResolving({ data: [forecast], error: null })

    await expect(readCompletedForecast(client, USER_ID, RECORD_ID)).resolves.toEqual(forecast)
    expect(calls).toContainEqual(["from", "scheduled_services"])
    expect(calls).toContainEqual(["eq", "user_id", USER_ID])
    expect(calls).toContainEqual(["eq", "completed_record_id", RECORD_ID])
    expect(calls).toContainEqual(["eq", "status", "completed"])
  })

  it("returns null when the record completed no forecast", async () => {
    const { client } = clientResolving({ data: [], error: null })

    await expect(readCompletedForecast(client, USER_ID, RECORD_ID)).resolves.toBeNull()
  })

  it("throws instead of guessing when the lookup fails", async () => {
    const { client } = clientResolving({ data: null, error: { message: "provider detail" } })

    await expect(readCompletedForecast(client, USER_ID, RECORD_ID)).rejects.toThrow()
  })
})
