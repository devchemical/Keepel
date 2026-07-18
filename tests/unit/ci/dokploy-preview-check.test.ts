import { describe, expect, it } from "vitest"

import {
  createPreviewState,
  evaluateDokployComment,
  extractPreviewUrl,
  findDokployComment,
} from "../../../.github/scripts/dokploy-preview-check.mjs"

const PR_UPDATED_AT = "2026-07-18T09:22:06.000Z"
const BUILDING_AT = "2026-07-18T09:22:11.000Z"
const DONE_AT = "2026-07-18T09:24:37.000Z"
const PREVIEW_URL = "http://preview-keepel-ym4zdo-jwqaqh.pr.chemicaldev.com"

function dokployBody(status: "Building" | "Done" | "Failed", url = PREVIEW_URL) {
  const icon = status === "Building" ? "🔄" : status === "Done" ? "✅" : "❌"

  return `### Dokploy Preview Deployment

| Name | Status | Preview | Updated (UTC) |
| --- | --- | --- | --- |
| Keepel | ${icon} ${status} | [Preview URL](${url}) | ${DONE_AT} |`
}

function comment({
  id = 5010737589,
  login = "dokploy-chemicaldev-3[bot]",
  status = "Building",
  createdAt = BUILDING_AT,
  updatedAt = BUILDING_AT,
}: {
  id?: number
  login?: string
  status?: "Building" | "Done" | "Failed"
  createdAt?: string
  updatedAt?: string
} = {}) {
  return {
    id,
    body: dokployBody(status),
    created_at: createdAt,
    updated_at: updatedAt,
    user: { login },
  }
}

describe("findDokployComment", () => {
  it("ignores lookalike comments and returns the latest comment from the Dokploy bot", () => {
    const spoofed = comment({ id: 1, login: "contributor", status: "Done", updatedAt: DONE_AT })
    const actual = comment({ id: 2, status: "Building" })

    expect(findDokployComment([spoofed, actual])).toEqual(actual)
  })
})

describe("evaluateDokployComment", () => {
  it("accepts Done only after observing a fresh Building transition on an existing comment", () => {
    const initialState = createPreviewState()
    const building = comment({ createdAt: "2026-06-12T18:37:37.000Z" })

    const buildingResult = evaluateDokployComment(initialState, building, PR_UPDATED_AT)

    expect(buildingResult).toMatchObject({ kind: "wait", reason: "building" })

    const done = comment({
      createdAt: building.created_at,
      status: "Done",
      updatedAt: DONE_AT,
    })
    const doneResult = evaluateDokployComment(buildingResult.state, done, PR_UPDATED_AT)

    expect(doneResult).toMatchObject({ kind: "ready", previewUrl: PREVIEW_URL })
  })

  it("accepts a terminal state immediately when Dokploy created the comment for this event", () => {
    const freshDone = comment({ status: "Done", createdAt: BUILDING_AT, updatedAt: DONE_AT })

    expect(evaluateDokployComment(createPreviewState(), freshDone, PR_UPDATED_AT)).toMatchObject({
      kind: "ready",
      previewUrl: PREVIEW_URL,
    })
  })

  it("ignores a stale Done from a previous deployment", () => {
    const staleDone = comment({
      status: "Done",
      createdAt: "2026-06-12T18:37:37.000Z",
      updatedAt: "2026-07-18T09:21:59.000Z",
    })

    expect(evaluateDokployComment(createPreviewState(), staleDone, PR_UPDATED_AT)).toMatchObject({
      kind: "wait",
      reason: "stale-update",
    })
  })

  it("does not accept a newer Done on an old comment without first seeing Building", () => {
    const overlappingDone = comment({
      status: "Done",
      createdAt: "2026-06-12T18:37:37.000Z",
      updatedAt: DONE_AT,
    })

    expect(evaluateDokployComment(createPreviewState(), overlappingDone, PR_UPDATED_AT)).toMatchObject({
      kind: "wait",
      reason: "awaiting-building",
    })
  })

  it("fails immediately when the observed deployment changes from Building to Failed", () => {
    const buildingResult = evaluateDokployComment(
      createPreviewState(),
      comment({ createdAt: "2026-06-12T18:37:37.000Z" }),
      PR_UPDATED_AT
    )
    const failed = comment({
      createdAt: "2026-06-12T18:37:37.000Z",
      status: "Failed",
      updatedAt: DONE_AT,
    })

    expect(evaluateDokployComment(buildingResult.state, failed, PR_UPDATED_AT)).toMatchObject({
      kind: "failure",
      reason: "deployment-failed",
    })
  })
})

describe("extractPreviewUrl", () => {
  it("accepts the current Dokploy preview domain over HTTP", () => {
    expect(extractPreviewUrl(dokployBody("Done"))).toBe(PREVIEW_URL)
  })

  it("rejects URLs outside the configured preview hostname", () => {
    expect(extractPreviewUrl(dokployBody("Done", "https://example.com/preview"))).toBeNull()
  })
})
