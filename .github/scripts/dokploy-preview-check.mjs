import { pathToFileURL } from "node:url"

/* oxlint-disable no-console -- Console output is the CLI interface in GitHub Actions. */

const DOKPLOY_BOT_LOGIN = "dokploy-chemicaldev-3[bot]"
const DOKPLOY_HEADING = "### Dokploy Preview Deployment"
const DOKPLOY_APP_ROW = /^\|\s*Keepel\s*\|/m
const PREVIEW_HOST = /^preview-[a-z0-9-]+\.pr\.chemicaldev\.com$/
const COMMENT_DISCOVERY_TIMEOUT_MS = 90_000
const DEPLOYMENT_TIMEOUT_MS = 9 * 60_000
const POLL_INTERVAL_MS = 10_000
const HEALTH_CHECK_TIMEOUT_MS = 60_000
const HEALTH_CHECK_INTERVAL_MS = 5_000
const REQUEST_TIMEOUT_MS = 15_000
const MAX_COMMENT_PAGES = 10
const MAX_CONSECUTIVE_API_ERRORS = 3
const HEALTHY_HTTP_STATUSES = new Set([200, 204, 301, 302, 307, 308])

export function createPreviewState() {
  return {
    phase: "awaiting-building",
    commentId: null,
    buildingUpdatedAtMs: null,
  }
}

export function findDokployComment(comments) {
  return (
    comments
      .filter(
        (comment) =>
          comment?.user?.login === DOKPLOY_BOT_LOGIN &&
          typeof comment.body === "string" &&
          comment.body.includes(DOKPLOY_HEADING) &&
          DOKPLOY_APP_ROW.test(comment.body)
      )
      .toSorted((left, right) => parseTimestamp(left.updated_at) - parseTimestamp(right.updated_at))
      .at(-1) ?? null
  )
}

export function extractPreviewUrl(body) {
  if (typeof body !== "string") return null

  const match = body.match(/\[Preview URL\]\((https?:\/\/[^\s)]+)\)/i)
  if (!match) return null

  try {
    const url = new URL(match[1])
    const isAllowedProtocol = url.protocol === "http:" || url.protocol === "https:"
    const isAllowedHost = PREVIEW_HOST.test(url.hostname)
    const hasDefaultAuthority = url.username === "" && url.password === "" && url.port === ""

    return isAllowedProtocol && isAllowedHost && hasDefaultAuthority ? match[1] : null
  } catch {
    return null
  }
}

export function evaluateDokployComment(state, comment, pullRequestUpdatedAt) {
  const eventUpdatedAtMs = parseTimestamp(pullRequestUpdatedAt)
  const commentCreatedAtMs = parseTimestamp(comment?.created_at)
  const commentUpdatedAtMs = parseTimestamp(comment?.updated_at)

  if (![eventUpdatedAtMs, commentCreatedAtMs, commentUpdatedAtMs].every(Number.isFinite)) {
    return wait(state, "invalid-timestamp")
  }

  if (commentUpdatedAtMs < eventUpdatedAtMs) {
    return wait(state, "stale-update")
  }

  const status = readDokployStatus(comment.body)

  if (status === "building") {
    return wait(
      {
        phase: "building",
        commentId: comment.id,
        buildingUpdatedAtMs: commentUpdatedAtMs,
      },
      "building"
    )
  }

  if (status !== "done" && status !== "failed") {
    return wait(state, "unknown-status")
  }

  const commentCreatedForEvent = commentCreatedAtMs >= eventUpdatedAtMs
  const followsObservedBuilding =
    state.phase === "building" && state.commentId === comment.id && commentUpdatedAtMs >= state.buildingUpdatedAtMs

  if (!commentCreatedForEvent && !followsObservedBuilding) {
    return wait(state, "awaiting-building")
  }

  if (status === "failed") {
    return { kind: "failure", reason: "deployment-failed", state }
  }

  const previewUrl = extractPreviewUrl(comment.body)
  if (!previewUrl) {
    return { kind: "failure", reason: "invalid-preview-url", state }
  }

  return { kind: "ready", previewUrl, state }
}

function readDokployStatus(body) {
  if (typeof body !== "string") return "unknown"
  if (/\|\s*✅\s*Done\s*\|/i.test(body)) return "done"
  if (/\|\s*❌\s*Failed\s*\|/i.test(body)) return "failed"
  if (/\|\s*🔄\s*Building\s*\|/i.test(body)) return "building"
  return "unknown"
}

function parseTimestamp(value) {
  return typeof value === "string" ? Date.parse(value) : Number.NaN
}

function wait(state, reason) {
  return { kind: "wait", reason, state }
}

async function run() {
  const config = readConfig(process.env)
  const startedAtMs = Date.now()
  let state = createPreviewState()
  let consecutiveApiErrors = 0
  let attempt = 0

  console.log(`Esperando la preview de Dokploy para la PR #${config.pullRequestNumber}...`)

  while (Date.now() - startedAtMs < DEPLOYMENT_TIMEOUT_MS) {
    attempt += 1

    let comments
    try {
      comments = await fetchPullRequestComments(config)
      consecutiveApiErrors = 0
    } catch (error) {
      consecutiveApiErrors += 1
      console.warn(
        `No se pudieron consultar los comentarios (${consecutiveApiErrors}/${MAX_CONSECUTIVE_API_ERRORS}): ${safeMessage(error)}`
      )

      if (consecutiveApiErrors >= MAX_CONSECUTIVE_API_ERRORS) {
        throw new Error("La API de GitHub falló repetidamente al consultar los comentarios", {
          cause: error,
        })
      }

      await sleep(POLL_INTERVAL_MS)
      continue
    }

    const comment = findDokployComment(comments)
    if (!comment) {
      if (Date.now() - startedAtMs >= COMMENT_DISCOVERY_TIMEOUT_MS) {
        throw new Error("Dokploy no publicó su comentario dentro de 90 segundos")
      }

      console.log(`Intento ${attempt}: Dokploy todavía no ha publicado el comentario.`)
      await sleep(POLL_INTERVAL_MS)
      continue
    }

    const result = evaluateDokployComment(state, comment, config.pullRequestUpdatedAt)
    state = result.state

    if (result.kind === "failure") {
      if (result.reason === "invalid-preview-url") {
        throw new Error("Dokploy marcó el despliegue como Done, pero publicó una URL no permitida")
      }

      throw new Error("Dokploy marcó el despliegue como Failed")
    }

    if (result.kind === "ready") {
      console.log(`Dokploy completó el despliegue: ${result.previewUrl}`)
      await waitForHealthyPreview(result.previewUrl)
      console.log("La preview está desplegada y responde correctamente.")
      return
    }

    console.log(`Intento ${attempt}: ${describeWaitReason(result.reason)}`)
    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error("Dokploy no completó la preview dentro de 9 minutos")
}

function readConfig(environment) {
  const githubToken = environment.GH_TOKEN
  const repository = environment.REPO
  const pullRequestNumber = environment.PR_NUMBER
  const pullRequestUpdatedAt = environment.PR_UPDATED_AT

  if (!githubToken) throw new Error("Falta GH_TOKEN")
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("REPO no tiene el formato owner/repository")
  }
  if (!pullRequestNumber || !/^\d+$/.test(pullRequestNumber)) {
    throw new Error("PR_NUMBER no es válido")
  }
  if (!pullRequestUpdatedAt || !Number.isFinite(Date.parse(pullRequestUpdatedAt))) {
    throw new Error("PR_UPDATED_AT no es válido")
  }

  return { githubToken, repository, pullRequestNumber, pullRequestUpdatedAt }
}

async function fetchPullRequestComments(config) {
  const comments = []
  let nextUrl = new URL(
    `https://api.github.com/repos/${config.repository}/issues/${config.pullRequestNumber}/comments?per_page=100`
  )

  for (let page = 1; nextUrl; page += 1) {
    if (page > MAX_COMMENT_PAGES) {
      throw new Error(`La PR supera el límite de ${MAX_COMMENT_PAGES * 100} comentarios`)
    }

    const response = await fetchWithTimeout(nextUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub respondió HTTP ${response.status}`)
    }

    const pageComments = await response.json()
    if (!Array.isArray(pageComments)) {
      throw new Error("GitHub devolvió una respuesta inesperada")
    }

    comments.push(...pageComments)
    nextUrl = readNextPage(response.headers.get("link"))
  }

  return comments
}

function readNextPage(linkHeader) {
  if (!linkHeader) return null

  const nextLink = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="next"'))
  const match = nextLink?.match(/^<([^>]+)>;/)
  if (!match) return null

  const nextUrl = new URL(match[1])
  if (nextUrl.origin !== "https://api.github.com") {
    throw new Error("GitHub devolvió una URL de paginación no permitida")
  }

  return nextUrl
}

async function waitForHealthyPreview(previewUrl) {
  const deadlineMs = Date.now() + HEALTH_CHECK_TIMEOUT_MS
  let attempt = 0

  while (Date.now() < deadlineMs) {
    attempt += 1

    try {
      const response = await fetchWithTimeout(previewUrl, { redirect: "manual" })
      console.log(`Health check ${attempt}: HTTP ${response.status}`)

      if (HEALTHY_HTTP_STATUSES.has(response.status)) return
    } catch (error) {
      console.log(`Health check ${attempt}: ${safeMessage(error)}`)
    }

    await sleep(HEALTH_CHECK_INTERVAL_MS)
  }

  throw new Error("La preview no respondió correctamente dentro de 60 segundos")
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function describeWaitReason(reason) {
  const messages = {
    "awaiting-building": "esperando una transición Building del despliegue actual.",
    building: "Dokploy sigue construyendo.",
    "invalid-timestamp": "el comentario contiene fechas no válidas.",
    "stale-update": "el comentario todavía corresponde a un despliegue anterior.",
    "unknown-status": "el comentario todavía no contiene un estado reconocido.",
  }

  return messages[reason] ?? "esperando una actualización de Dokploy."
}

function safeMessage(error) {
  return error instanceof Error ? error.message.replace(/[\r\n]+/g, " ") : "Error desconocido"
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    const message = safeMessage(error).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")
    console.error(`::error::${message}`)
    process.exitCode = 1
  })
}
