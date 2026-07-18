import { AUTH_ERROR_CODE, AUTH_STATE_STATUS, type AuthState, type CurrentUser, type UserId } from "./contracts"

export interface AuthServerAdapterUser {
  id: string
  email?: string | null
  userMetadata?: Record<string, unknown> | null
}

export interface AuthServerAdapter {
  getUser(): Promise<unknown>
}

export class AuthenticationRequiredError extends Error {
  readonly code = AUTH_ERROR_CODE.AUTHENTICATION_REQUIRED

  constructor() {
    super("Authentication is required")
    this.name = "AuthenticationRequiredError"
  }
}

export class AuthenticationProviderError extends Error {
  readonly code = AUTH_ERROR_CODE.PROVIDER_ERROR

  constructor() {
    super("Authentication provider returned an invalid response")
    this.name = "AuthenticationProviderError"
  }
}

function readDisplayName(metadata: Record<string, unknown> | null | undefined) {
  const candidates = [metadata?.name, metadata?.full_name]

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim()
    }
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseAdapterUser(value: unknown): AuthServerAdapterUser | null {
  if (value === null) {
    return null
  }

  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
    throw new AuthenticationProviderError()
  }

  if (value.email !== undefined && value.email !== null && typeof value.email !== "string") {
    throw new AuthenticationProviderError()
  }

  if (value.userMetadata !== undefined && value.userMetadata !== null && !isRecord(value.userMetadata)) {
    throw new AuthenticationProviderError()
  }

  return {
    id: value.id,
    email: value.email,
    userMetadata: value.userMetadata,
  }
}

export function projectCurrentUser(user: AuthServerAdapterUser): CurrentUser {
  const email = user.email ?? null

  return {
    id: user.id as UserId,
    email,
    displayName: readDisplayName(user.userMetadata) ?? email?.split("@")[0] ?? "Usuario",
  }
}

export function createAuthServerApi(adapter: AuthServerAdapter) {
  async function getCurrentUser() {
    const user = parseAdapterUser(await adapter.getUser())

    return user ? projectCurrentUser(user) : null
  }

  async function requireCurrentUser() {
    const user = await getCurrentUser()

    if (!user) {
      throw new AuthenticationRequiredError()
    }

    return user
  }

  async function getAuthState(): Promise<AuthState> {
    const user = await getCurrentUser()

    return user
      ? { status: AUTH_STATE_STATUS.AUTHENTICATED, user }
      : { status: AUTH_STATE_STATUS.ANONYMOUS, user: null }
  }

  return {
    getCurrentUser,
    requireCurrentUser,
    getAuthState,
  }
}
