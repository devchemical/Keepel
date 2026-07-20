/* eslint-disable no-console -- Controlled E2E service reports startup and request failures. */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { APP_URL, CONTROLLED_SERVICES_URL, type ControlledOAuthMode } from "./controlled-services-config"

const controlledServicesUrl = new URL(CONTROLLED_SERVICES_URL)
const HOST = controlledServicesUrl.hostname
const PORT = Number(controlledServicesUrl.port)
const PASSWORD = "correct-horse"

interface ControlledUser {
  id: string
  email: string
  app_metadata: { provider: "email"; providers: ["email"] }
  aud: "authenticated"
  confirmed_at?: string
  created_at: string
  email_confirmed_at?: string
  identities: []
  is_anonymous: false
  role: "authenticated"
  updated_at: string
  user_metadata: { full_name: string }
}

const sessions = new Map<string, ControlledUser>()
let sessionSequence = 0
let oauthMode: ControlledOAuthMode = "success"

function corsHeaders() {
  return {
    "access-control-allow-headers":
      "accept-profile, apikey, authorization, content-profile, content-type, prefer, x-client-info, x-supabase-api-version",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-origin": APP_URL,
    "access-control-expose-headers": "content-range",
  }
}

function sendJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, {
    ...corsHeaders(),
    "content-type": "application/json",
    ...headers,
  })
  response.end(status === 204 ? undefined : JSON.stringify(body))
}

function sendRedirect(response: ServerResponse, destination: string) {
  response.writeHead(302, { ...corsHeaders(), location: destination })
  response.end()
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return null
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function encodeJwtPart(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function createAccessToken(user: ControlledUser) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const header = encodeJwtPart({ alg: "HS256", typ: "JWT" })
  const payload = encodeJwtPart({
    aud: "authenticated",
    email: user.email,
    exp: issuedAt + 60 * 60,
    iat: issuedAt,
    role: "authenticated",
    sub: user.id,
  })

  return `${header}.${payload}.controlled-signature`
}

function createUser(email: string, fullName = "Ada Driver"): ControlledUser {
  return {
    id: "00000000-0000-4000-8000-000000000051",
    email,
    app_metadata: { provider: "email", providers: ["email"] },
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
    identities: [],
    is_anonymous: false,
    role: "authenticated",
    updated_at: "2026-01-01T00:00:00.000Z",
    user_metadata: { full_name: fullName },
  }
}

function createSession(user: ControlledUser) {
  const accessToken = createAccessToken(user)
  const refreshToken = `controlled-refresh-${++sessionSequence}`
  const authenticatedUser = {
    ...user,
    confirmed_at: "2026-01-01T00:00:00.000Z",
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
  }
  sessions.set(accessToken, authenticatedUser)

  return {
    access_token: accessToken,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: refreshToken,
    token_type: "bearer",
    user: authenticatedUser,
  }
}

function readBearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null
}

function handleRedis(body: unknown) {
  if (!Array.isArray(body)) {
    return { result: 1 }
  }

  const command = String(body[0] ?? "").toLowerCase()
  return command === "evalsha" || command === "eval" ? { result: [100, 100] } : { result: 1 }
}

async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`)

  if (request.method === "OPTIONS") {
    sendJson(response, 204, null)
    return
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === "POST" && url.pathname === "/__test__/reset") {
    const body = (await readJson(request)) as { oauthMode?: unknown } | null
    sessions.clear()
    sessionSequence = 0
    oauthMode =
      body?.oauthMode === "cancel" || body?.oauthMode === "provider_error" || body?.oauthMode === "exchange_error"
        ? body.oauthMode
        : "success"
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === "GET" && url.pathname === "/auth/v1/authorize") {
    const redirectTo = url.searchParams.get("redirect_to")

    if (!redirectTo) {
      sendJson(response, 400, { message: "redirect_to is required" })
      return
    }

    const callbackUrl = new URL(redirectTo)

    if (oauthMode === "cancel") {
      callbackUrl.searchParams.set("error", "access_denied")
      callbackUrl.searchParams.set("error_description", "controlled provider description")
    } else if (oauthMode === "provider_error") {
      callbackUrl.searchParams.set("error", "server_error")
      callbackUrl.searchParams.set("error_description", "controlled-provider-secret")
    } else {
      callbackUrl.searchParams.set("code", "controlled-oauth-code")
    }

    sendRedirect(response, callbackUrl.toString())
    return
  }

  if (request.method === "POST" && url.pathname === "/auth/v1/token") {
    const body = (await readJson(request)) as { email?: unknown; password?: unknown } | null
    const grantType = url.searchParams.get("grant_type")

    if (grantType === "pkce") {
      if (oauthMode === "exchange_error") {
        sendJson(response, 400, {
          code: "bad_oauth_state",
          message: "controlled-provider-secret",
          msg: "controlled-provider-secret",
        })
        return
      }

      sendJson(response, 200, createSession(createUser("driver@keepel.test")))
      return
    }

    if (grantType !== "password" || body?.password !== PASSWORD || typeof body.email !== "string") {
      sendJson(response, 400, {
        code: "invalid_credentials",
        error_code: "invalid_credentials",
        message: "Invalid login credentials",
        msg: "Invalid login credentials",
      })
      return
    }

    sendJson(response, 200, createSession(createUser(body.email)))
    return
  }

  if (request.method === "POST" && url.pathname === "/auth/v1/signup") {
    const body = (await readJson(request)) as { email?: unknown; data?: { full_name?: unknown } } | null

    if (typeof body?.email !== "string") {
      sendJson(response, 400, { code: "validation_failed", message: "Email is required" })
      return
    }

    const fullName = typeof body.data?.full_name === "string" ? body.data.full_name : "Keepel User"
    sendJson(response, 200, {
      ...createUser(body.email, fullName),
      confirmation_sent_at: "2026-01-01T00:00:00.000Z",
    })
    return
  }

  if (request.method === "GET" && url.pathname === "/auth/v1/user") {
    const accessToken = readBearerToken(request)
    const user = accessToken ? sessions.get(accessToken) : null

    if (!user) {
      sendJson(response, 401, {
        code: "session_not_found",
        error_code: "session_not_found",
        message: "Auth session missing!",
        msg: "Auth session missing!",
      })
      return
    }

    sendJson(response, 200, user)
    return
  }

  if (request.method === "GET" && url.pathname.startsWith("/rest/v1/")) {
    sendJson(response, 200, [], { "content-range": "0-0/0" })
    return
  }

  if (request.method === "POST" && url.pathname === "/pipeline") {
    const commands = await readJson(request)
    const results = Array.isArray(commands) ? commands.map(handleRedis) : []
    sendJson(response, 200, results)
    return
  }

  if (request.method === "POST" && url.pathname === "/") {
    sendJson(response, 200, handleRedis(await readJson(request)))
    return
  }

  sendJson(response, 404, { message: "Not found" })
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    console.error(error)
    sendJson(response, 500, { message: "Controlled service failure" })
  })
})

server.listen(PORT, HOST, () => {
  console.log(`Controlled services listening on http://${HOST}:${PORT}`)
})

function shutdown() {
  server.close(() => process.exit(0))
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
