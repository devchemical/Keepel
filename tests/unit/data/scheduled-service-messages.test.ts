import { describe, expect, it } from "vitest"
import { completedForecastWarning } from "@/lib/data/scheduled-service-messages"

describe("completed forecast deletion warning", () => {
  it("names the forecast's type and date", () => {
    expect(completedForecastWarning({ type: "oil_change", scheduled_date: "2026-01-01" })).toBe(
      "Este registro completó la previsión de Cambio de Aceite del 1 de enero de 2026. Al eliminarlo, la previsión volverá a quedar pendiente."
    )
  })

  it("names only the type when the forecast has no date", () => {
    expect(completedForecastWarning({ type: "battery", scheduled_date: null })).toBe(
      "Este registro completó la previsión de Batería. Al eliminarlo, la previsión volverá a quedar pendiente."
    )
  })

  it("falls back to the raw type of an unknown value", () => {
    expect(completedForecastWarning({ type: "legacy", scheduled_date: null })).toBe(
      "Este registro completó la previsión de legacy. Al eliminarlo, la previsión volverá a quedar pendiente."
    )
  })
})
