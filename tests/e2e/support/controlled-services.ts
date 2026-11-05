/* eslint-disable no-console -- Controlled E2E service reports startup and request failures. */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import {
  APP_URL,
  CONTROLLED_SERVICES_URL,
  type ControlledOAuthMode,
  type ControlledRateLimitMode,
} from "./controlled-services-config"

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
const analyticsEvents: unknown[] = []
let maintenanceMode = false
const maintenanceRecords: Record<string, unknown>[] = []
const dataReceipts = new Map<string, unknown>()
let vehicleExists = true
const maintenanceReceipts = new Map<string, unknown>()
const maintenanceAttempts: string[] = []
let maintenanceAvailable = true
let maintenanceSchedules: Record<string, unknown>[] = []
const maintenanceVehicle = {
  id: "00000000-0000-4000-8000-000000000093",
  user_id: "00000000-0000-4000-8000-000000000051",
  make: "Synthetic",
  model: "Maintenance",
  year: 2020,
  mileage: 0,
  license_plate: null,
  vin: null,
  color: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}
let sessionSequence = 0
let oauthMode: ControlledOAuthMode = "success"
let rateLimitMode: ControlledRateLimitMode = "success"

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
    const body = (await readJson(request)) as {
      oauthMode?: unknown
      rateLimitMode?: unknown
      maintenance?: unknown
      emptyVehicles?: boolean
      maintenanceResponse?: unknown
      maintenanceSchedule?: unknown
      schedules?: Record<string, unknown>[]
      vehicleMileage?: number
      records?: Record<string, unknown>[]
    } | null
    maintenanceMode = body?.maintenance === true
    maintenanceRecords.length = 0
    maintenanceRecords.push(...(body?.records ?? []))
    maintenanceVehicle.id = "00000000-0000-4000-8000-000000000093"
    dataReceipts.clear()
    vehicleExists = body?.emptyVehicles !== true
    maintenanceVehicle.make = "Synthetic"
    maintenanceVehicle.model = "Maintenance"
    maintenanceVehicle.license_plate = null
    maintenanceReceipts.clear()
    maintenanceAttempts.length = 0
    maintenanceAvailable = body?.maintenanceResponse !== "unavailable"
    maintenanceVehicle.mileage = body?.vehicleMileage ?? 0
    const initialForecast =
      body?.maintenanceSchedule === true
        ? {
            id: "00000000-0000-4000-8000-000000000094",
            vehicle_id: maintenanceVehicle.id,
            user_id: maintenanceVehicle.user_id,
            type: "oil_change",
            description: null,
            scheduled_date: "2026-01-01",
            scheduled_mileage: null,
            status: "pending",
            notes: null,
            completed_record_id: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          }
        : null
    maintenanceSchedules = body?.schedules ?? (initialForecast ? [initialForecast] : [])
    sessions.clear()
    analyticsEvents.length = 0
    sessionSequence = 0
    oauthMode =
      body?.oauthMode === "cancel" || body?.oauthMode === "provider_error" || body?.oauthMode === "exchange_error"
        ? body.oauthMode
        : "success"
    rateLimitMode = body?.rateLimitMode === "error" ? "error" : "success"
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === "GET" && url.pathname === "/__test__/analytics") {
    sendJson(response, 200, { events: analyticsEvents })
    return
  }

  if (request.method === "POST" && url.pathname === "/track") {
    const clientId = request.headers["openpanel-client-id"]
    const clientSecret = request.headers["openpanel-client-secret"]

    if (clientId !== "e2e-openpanel-writer" || clientSecret !== "e2e-openpanel-secret") {
      sendJson(response, 401, { message: "Invalid OpenPanel credentials" })
      return
    }

    analyticsEvents.push(await readJson(request))
    sendJson(response, 202, { accepted: true })
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

  if (request.method === "GET" && url.pathname === "/__test__/maintenance") {
    sendJson(response, 200, {
      records: maintenanceRecords,
      attempts: maintenanceAttempts,
      forecast: maintenanceSchedules[0] ?? null,
      schedules: maintenanceSchedules,
    })
    return
  }
  if (request.method === "POST" && url.pathname === "/__test__/maintenance-response") {
    const body = (await readJson(request)) as { available?: boolean }
    maintenanceAvailable = body.available === true
    sendJson(response, 200, { ok: true })
    return
  }
  if (maintenanceMode && request.method === "POST" && url.pathname === "/rest/v1/rpc/get_data_operation") {
    const body = (await readJson(request)) as { p_operation_id: string }
    sendJson(response, 200, dataReceipts.get(body.p_operation_id) ?? null)
    return
  }
  if (maintenanceMode && request.method === "POST" && url.pathname === "/rest/v1/rpc/mutate_data") {
    const body = (await readJson(request)) as {
      p_operation_id: string
      p_action: string
      p_id: string
      p_values: Record<string, unknown>
    }
    if (dataReceipts.has(body.p_operation_id)) {
      sendJson(response, 200, dataReceipts.get(body.p_operation_id))
      return
    }
    let row: Record<string, unknown> | undefined
    if (body.p_action === "vehicle.update" && vehicleExists && body.p_id === maintenanceVehicle.id) {
      Object.assign(maintenanceVehicle, body.p_values)
      row = maintenanceVehicle
    } else if (body.p_action === "vehicle.delete" && vehicleExists && body.p_id === maintenanceVehicle.id) {
      row = { ...maintenanceVehicle }
      vehicleExists = false
      maintenanceRecords.length = 0
      maintenanceSchedules.length = 0
    } else if (body.p_action === "vehicle.create") {
      Object.assign(maintenanceVehicle, body.p_values, { id: body.p_id })
      vehicleExists = true
      row = maintenanceVehicle
    } else if (body.p_action === "schedule.create") {
      row = {
        ...body.p_values,
        id: body.p_id,
        user_id: maintenanceVehicle.user_id,
        status: "pending",
        completed_record_id: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }
      maintenanceSchedules.push(row)
    } else if (body.p_action === "schedule.update" || body.p_action === "schedule.cancel") {
      row = maintenanceSchedules.find((value) => value.id === body.p_id && value.status === "pending")
      if (row)
        Object.assign(
          row,
          body.p_action === "schedule.cancel" ? { status: "cancelled", completed_record_id: null } : body.p_values
        )
    } else if (body.p_action === "maintenance.update" || body.p_action === "maintenance.delete") {
      row = maintenanceRecords.find((value) => value.id === body.p_id)
      if (row && body.p_action === "maintenance.update") Object.assign(row, body.p_values)
      if (row && body.p_action === "maintenance.delete") maintenanceRecords.splice(maintenanceRecords.indexOf(row), 1)
    }
    if (!row) {
      sendJson(response, 400, { code: "P0001", message: "No affected row" })
      return
    }
    const receipt = { operation_id: body.p_operation_id, action: body.p_action, row: { ...row } }
    dataReceipts.set(body.p_operation_id, receipt)
    sendJson(response, 200, receipt)
    return
  }
  if (maintenanceMode && request.method === "POST" && url.pathname === "/rest/v1/rpc/get_maintenance_batch_operation") {
    const body = (await readJson(request)) as { p_operation_id: string }
    sendJson(
      response,
      maintenanceAvailable ? 200 : 503,
      maintenanceAvailable
        ? (maintenanceReceipts.get(body.p_operation_id) ?? null)
        : { message: "Controlled unavailable response" }
    )
    return
  }
  if (maintenanceMode && request.method === "GET" && url.pathname === "/rest/v1/vehicles") {
    sendJson(
      response,
      200,
      request.headers.accept?.includes("vnd.pgrst.object")
        ? maintenanceVehicle
        : vehicleExists && !url.searchParams.has("id")
          ? [maintenanceVehicle]
          : []
    )
    return
  }
  if (maintenanceMode && request.method === "GET" && url.pathname === "/rest/v1/scheduled_services") {
    sendJson(
      response,
      200,
      maintenanceSchedules
        .filter(
          (row) =>
            row.status === "pending" &&
            (!url.searchParams.has("id") || String(row.id) > (url.searchParams.get("id") ?? "").slice(3))
        )
        .map((row) => ({ ...row, vehicles: maintenanceVehicle }))
    )
    return
  }
  if (maintenanceMode && url.pathname === "/rest/v1/scheduled_services" && request.method === "POST") {
    const body = (await readJson(request)) as Record<string, unknown>
    const row = {
      ...body,
      id: crypto.randomUUID(),
      completed_record_id: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }
    maintenanceSchedules.push(row)
    sendJson(response, 201, { ...row, vehicles: maintenanceVehicle })
    return
  }
  if (maintenanceMode && url.pathname === "/rest/v1/scheduled_services" && request.method === "PATCH") {
    const body = (await readJson(request)) as Record<string, unknown>
    const row = maintenanceSchedules.find(
      (item) => `eq.${item.id}` === url.searchParams.get("id") && item.status === "pending"
    )
    if (!row) {
      sendJson(response, 406, { code: "PGRST116", message: "No pending row" })
      return
    }
    Object.assign(row, body)
    sendJson(response, 200, { ...row, vehicles: maintenanceVehicle })
    return
  }
  if (request.method === "POST" && url.pathname === "/rest/v1/rpc/maintenance_totals") {
    const body = (await readJson(request)) as { p_vehicle_id?: string }
    const rows = maintenanceRecords.filter((row) => !body.p_vehicle_id || row.vehicle_id === body.p_vehicle_id)
    sendJson(response, 200, [
      { record_count: rows.length, total_cost: rows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0) },
    ])
    return
  }
  if (maintenanceMode && request.method === "GET" && url.pathname === "/rest/v1/maintenance_records") {
    const cursor = url.searchParams.get("or")
    const date = cursor?.match(/service_date\.lt\.([0-9-]+)/)?.[1]
    const id = cursor?.match(/id\.lt\.([a-zA-Z0-9-]+)/)?.[1]
    const vehicleId = url.searchParams.get("vehicle_id")?.slice(3)
    const rows = maintenanceRecords
      .filter((row) => !vehicleId || row.vehicle_id === vehicleId)
      .toSorted(
        (a, b) =>
          String(b.service_date).localeCompare(String(a.service_date)) || String(b.id).localeCompare(String(a.id))
      )
      .filter(
        (row) => !date || String(row.service_date) < date || (row.service_date === date && String(row.id) < (id ?? ""))
      )
      .slice(0, Number(url.searchParams.get("limit") ?? 1000))
    sendJson(
      response,
      200,
      rows.map((row) => ({ ...row, vehicles: maintenanceVehicle }))
    )
    return
  }
  if (maintenanceMode && request.method === "POST" && url.pathname === "/rest/v1/rpc/create_maintenance_batch") {
    const body = (await readJson(request)) as {
      p_operation_id: string
      p_completion: { scheduled_service_id: string; service_index: number } | null
      p_batch: {
        services: Record<string, unknown>[]
        service_date: string
        mileage: number | null
        notes: string | null
      }
    }
    maintenanceAttempts.push(body.p_operation_id)
    if (maintenanceReceipts.has(body.p_operation_id)) {
      sendJson(response, 200, maintenanceReceipts.get(body.p_operation_id))
      return
    }
    const rows = body.p_batch.services.map((service, index) => ({
      ...service,
      id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
      vehicle_id: maintenanceVehicle.id,
      user_id: maintenanceVehicle.user_id,
      service_date: body.p_batch.service_date,
      mileage: body.p_batch.mileage,
      notes: body.p_batch.notes,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }))
    maintenanceRecords.push(...rows)
    const forecast = maintenanceSchedules.find((row) => row.id === body.p_completion?.scheduled_service_id)
    if (body.p_completion && forecast) {
      Object.assign(forecast, { status: "completed", completed_record_id: rows[body.p_completion.service_index]?.id })
    }
    const receipt = {
      operation_id: body.p_operation_id,
      records: rows,
      vehicle: maintenanceVehicle,
      scheduled_service: body.p_completion ? forecast : null,
    }
    maintenanceReceipts.set(body.p_operation_id, receipt)
    sendJson(
      response,
      maintenanceAvailable ? 200 : 503,
      maintenanceAvailable ? receipt : { message: "Controlled lost response" }
    )
    return
  }
  if (request.method === "GET" && url.pathname.startsWith("/rest/v1/")) {
    sendJson(response, 200, [], { "content-range": "0-0/0" })
    return
  }

  if (request.method === "POST" && url.pathname === "/pipeline") {
    if (rateLimitMode === "error") {
      sendJson(response, 503, { message: "Controlled Redis failure" })
      return
    }

    const commands = await readJson(request)
    const results = Array.isArray(commands) ? commands.map(handleRedis) : []
    sendJson(response, 200, results)
    return
  }

  if (request.method === "POST" && url.pathname === "/") {
    if (rateLimitMode === "error") {
      sendJson(response, 503, { message: "Controlled Redis failure" })
      return
    }

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
