import { describe, expect, it } from "vitest"
import { prependOptimistic, removeOptimistic, replaceOptimistic } from "@/lib/data/optimistic-list"

describe("optimistic data updates", () => {
  it.each(["vehicle", "maintenance", "scheduled-service"])(
    "preserves %s insertion, replacement, and rollback behavior",
    (kind) => {
      const existing = { id: `${kind}-existing`, kind, persisted: true }
      const optimistic = { id: `${kind}-temp`, kind, persisted: false }
      const persisted = { id: `${kind}-persisted`, kind, persisted: true }
      const initial = [existing]

      const inserted = prependOptimistic(initial, optimistic)
      const replaced = replaceOptimistic(inserted, optimistic.id, persisted)
      const rolledBack = removeOptimistic(inserted, optimistic.id)

      expect(inserted).toEqual([optimistic, existing])
      expect(replaced).toEqual([persisted, existing])
      expect(rolledBack).toEqual(initial)
      expect(initial).toEqual([existing])
    }
  )
})
