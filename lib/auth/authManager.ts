/* eslint-disable no-console, typescript/no-explicit-any, typescript/no-non-null-assertion, unicorn/prefer-add-event-listener, unicorn/require-post-message-target-origin -- AuthManager centralizes diagnostics, Supabase cookie options are loose, and BroadcastChannel intentionally targets same-origin tabs. */

/**
 * AuthManager - Singleton centralizado para gestión de autenticación
 *
 * Sistema event-driven que:
 * - Mantiene estado de autenticación único en toda la app
 * - Responde a eventos de Supabase Auth
 * - Sincroniza sesiones entre tabs (BroadcastChannel)
 * - Maneja tokens y refresh automático
 * - Elimina dependencia de timeouts
 */

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient, User, Session } from "@supabase/supabase-js"

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
}

type AuthStateListener = (state: AuthState) => void

class AuthManager {
  private static instance: AuthManager | null = null
  private supabase: SupabaseClient
  private state: AuthState = {
    user: null,
    session: null,
    isLoading: true,
  }
  private listeners: Set<AuthStateListener> = new Set()
  private broadcastChannel: BroadcastChannel | null = null
  private authSubscription: { unsubscribe: () => void } | null = null

  private constructor() {
    // Crear cliente Supabase singleton
    this.supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            if (typeof document === "undefined") return undefined
            const cookies = document.cookie.split("; ")
            const cookie = cookies.find((c) => c.startsWith(`${name}=`))
            return cookie ? decodeURIComponent(cookie.split("=")[1]) : undefined
          },
          set(name: string, value: string, options: any) {
            if (typeof document === "undefined") return
            let cookie = `${name}=${encodeURIComponent(value)}`

            if (options?.maxAge) cookie += `; max-age=${options.maxAge}`
            if (options?.path) cookie += `; path=${options.path}`
            if (options?.domain) cookie += `; domain=${options.domain}`
            if (options?.sameSite) cookie += `; samesite=${options.sameSite}`
            if (options?.secure) cookie += "; secure"

            document.cookie = cookie
          },
          remove(name: string, options: any) {
            if (typeof document === "undefined") return
            let cookie = `${name}=; max-age=0`

            if (options?.path) cookie += `; path=${options.path}`
            if (options?.domain) cookie += `; domain=${options.domain}`

            document.cookie = cookie
          },
        },
      }
    )

    this.initialize()
  }

  /**
   * Obtener instancia singleton
   */
  public static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager()
    }
    return AuthManager.instance
  }

  /**
   * Inicializar sistema de autenticación
   */
  private async initialize() {
    // Setup BroadcastChannel para sincronización cross-tab
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.broadcastChannel = new BroadcastChannel("auth-state")

      this.broadcastChannel.onmessage = (event) => {
        if (event.data.type === "AUTH_STATE_CHANGE") {
          this.updateState(event.data.state)
        }
      }
    }

    // Obtener sesión inicial
    try {
      const {
        data: { session },
        error,
      } = await this.supabase.auth.getSession()

      if (error) {
        console.error("Error al obtener sesión inicial:", error)
      }

      this.updateState({
        user: session?.user ?? null,
        session: session ?? null,
        isLoading: false,
      })
    } catch (error) {
      console.error("Error inicializando auth:", error)
      this.updateState({ user: null, session: null, isLoading: false })
    }

    // Setup listener de eventos de autenticación
    const {
      data: { subscription },
    } = this.supabase.auth.onAuthStateChange(async (event, session) => {
      const newState: AuthState = {
        user: session?.user ?? null,
        session: session ?? null,
        isLoading: false,
      }

      this.updateState(newState)

      // Broadcast a otras tabs
      this.broadcastState(newState)

      // Manejar eventos específicos
      switch (event) {
        case "SIGNED_IN":
          break
        case "SIGNED_OUT":
          this.clearLocalState()
          break
        case "TOKEN_REFRESHED":
          break
        case "USER_UPDATED":
          break
      }
    })

    this.authSubscription = subscription
  }

  /**
   * Actualizar estado y notificar listeners
   */
  private updateState(newState: Partial<AuthState>) {
    this.state = { ...this.state, ...newState }
    this.notifyListeners()
  }

  /**
   * Broadcast estado a otras tabs
   */
  private broadcastState(state: AuthState) {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: "AUTH_STATE_CHANGE",
        state,
      })
    }
  }

  /**
   * Notificar a todos los listeners
   */
  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state))
  }

  /**
   * Limpiar estado local (storage, cookies)
   */
  private clearLocalState() {
    if (typeof window === "undefined") return

    // Limpiar localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.includes("supabase") || key.includes("sb-")) {
        localStorage.removeItem(key)
      }
    })

    // Limpiar sessionStorage
    Object.keys(sessionStorage).forEach((key) => {
      if (key.includes("supabase") || key.includes("sb-")) {
        sessionStorage.removeItem(key)
      }
    })

    // Limpiar cookies de forma más agresiva
    const cookies = document.cookie.split(";")
    const cookiesToDelete: string[] = []

    cookies.forEach((cookie) => {
      const cookieName = cookie.split("=")[0].trim()
      if (cookieName.includes("supabase") || cookieName.includes("sb-") || cookieName.startsWith("auth-")) {
        cookiesToDelete.push(cookieName)
      }
    })

    // Eliminar cada cookie con múltiples estrategias
    cookiesToDelete.forEach((cookieName) => {
      // Estrategia 1: path=/
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; max-age=0`

      // Estrategia 2: con domain
      const hostname = window.location.hostname
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${hostname}; max-age=0`

      // Estrategia 3: domain raíz
      const parts = hostname.split(".")
      if (parts.length > 2) {
        const rootDomain = `.${parts.slice(-2).join(".")}`
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${rootDomain}; max-age=0`
      }
    })
  }

  /**
   * Subscribe a cambios de estado
   */
  public subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener)
    // Notificar estado actual inmediatamente
    listener(this.state)

    // Retornar función de cleanup
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Obtener estado actual
   */
  public getState(): AuthState {
    return this.state
  }

  /**
   * Obtener usuario actual
   */
  public getUser(): User | null {
    return this.state.user
  }

  /**
   * Obtener sesión actual
   */
  public getSession(): Session | null {
    return this.state.session
  }

  /**
   * Verificar si está autenticado
   */
  public isAuthenticated(): boolean {
    return !!this.state.user && !!this.state.session
  }

  /**
   * Verificar si está cargando
   */
  public isLoading(): boolean {
    return this.state.isLoading
  }

  /**
   * Obtener cliente Supabase
   */
  public getSupabase(): SupabaseClient {
    return this.supabase
  }

  /**
   * Login con email/password
   */
  public async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  /**
   * Registro con email/password
   */
  public async signUp(email: string, password: string, metadata?: Record<string, any>) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })

    if (error) throw error
    return data
  }

  /**
   * Login con OAuth (Google, etc)
   */
  public async signInWithOAuth(provider: "google" | "github") {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) throw error
    return data
  }

  /**
   * Cerrar sesión
   */
  public async signOut() {
    try {
      // Limpiar estado local primero
      this.clearLocalState()

      // Actualizar estado UI
      this.updateState({
        user: null,
        session: null,
        isLoading: false,
      })

      // Llamar API de Supabase
      await this.supabase.auth.signOut()

      // Broadcast a otras tabs
      this.broadcastState({
        user: null,
        session: null,
        isLoading: false,
      })

      return true
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
      // Aun con error, aseguramos limpieza local
      this.clearLocalState()
      return false
    }
  }

  /**
   * Cleanup (destructor)
   */
  public destroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe()
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close()
    }
    this.listeners.clear()
    AuthManager.instance = null
  }
}

// Exportar instancia singleton
export const authManager = AuthManager.getInstance()

// Exportar tipo para TypeScript
export type { AuthState, AuthStateListener }
