"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Car, ChevronLeft, ChevronRight, Cookie, Gauge, LogOut, Menu, Shield, User } from "lucide-react"
import { LogoutControl } from "@/components/auth/logout-control"
import { usePrivacyConsent } from "@/components/privacy/consent-provider"
import { Button } from "@/components/ui/button"
import { ContextErrorBoundary } from "@/components/ui/context-error-boundary"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuthProjection } from "@/contexts"
import { AUTH_STATE_STATUS, type CurrentUser } from "@/lib/auth/contracts"
import { cn } from "@/lib/utils"

const RAIL_STORAGE_KEY = "keepel.dashboard.rail-expanded"
const PRIVACY_PATH = "/privacidad"

const NAVIGATION = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/vehicles", label: "Vehículos", icon: Car },
] as const

/**
 * Presentation membership only: the proxy and every private server operation still authenticate on their own.
 * `/privacidad` is public and joins the shell only while the visitor is authenticated.
 */
function isShellPath(pathname: string) {
  return pathname === "/" || pathname === PRIVACY_PATH || isWithin(pathname, "/vehicles")
}

function isWithin(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : isWithin(pathname, href)
}

/** Where the rail lives: the desktop rail is compact below `lg` whatever the stored preference says. */
type Placement = { mobile: true } | { mobile: false; expanded: boolean }

const ROW_CLASS_NAME =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm transition-[background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--shell-focus)] focus-visible:outline-none motion-reduce:transition-none"
const INACTIVE_ROW_CLASS_NAME =
  "text-[var(--shell-muted)] hover:bg-[var(--shell-elevated)] hover:text-[var(--shell-foreground)]"
const ACTIVE_ROW_CLASS_NAME = "bg-[var(--shell-active)] text-[var(--shell-active-foreground)]"

type RowTone = "active" | "inactive" | "static"

const ROW_TONE_CLASS_NAME: Record<RowTone, string> = {
  active: ACTIVE_ROW_CLASS_NAME,
  inactive: INACTIVE_ROW_CLASS_NAME,
  static: "text-[var(--shell-muted)]",
}

function rowClassName(placement: Placement, tone: RowTone = "inactive") {
  const alignment = placement.mobile
    ? "justify-start"
    : placement.expanded
      ? "justify-center lg:justify-start"
      : "justify-center"
  return cn(ROW_CLASS_NAME, ROW_TONE_CLASS_NAME[tone], alignment)
}

/** The desktop rail is compact at least below `lg`, so its rows keep their label as a tooltip. */
function rowTitle(placement: Placement, label: string) {
  return placement.mobile ? undefined : label
}

function RowIcon({ children }: { children: ReactNode }) {
  return <span className="flex w-5 shrink-0 items-center justify-center">{children}</span>
}

function RowLabel({ placement, children }: { placement: Placement; children: ReactNode }) {
  const className = placement.mobile ? "min-w-0" : placement.expanded ? "sr-only lg:not-sr-only lg:min-w-0" : "sr-only"
  return <span className={className}>{children}</span>
}

function NavigationLinks({ placement }: { placement: Placement }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-2">
      {NAVIGATION.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        const link = (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={rowTitle(placement, label)}
            className={cn(rowClassName(placement, active ? "active" : "inactive"), "font-medium")}
          >
            <RowIcon>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </RowIcon>
            <RowLabel placement={placement}>{label}</RowLabel>
          </Link>
        )
        return placement.mobile ? (
          <SheetClose asChild key={href}>
            {link}
          </SheetClose>
        ) : (
          link
        )
      })}
    </nav>
  )
}

function AccountControls({
  user,
  placement,
  openCookiePreferences,
}: {
  user: CurrentUser
  placement: Placement
  openCookiePreferences(): void
}) {
  const pathname = usePathname()
  const privacyActive = pathname === PRIVACY_PATH
  const privacyLink = (
    <Link
      href={PRIVACY_PATH}
      aria-current={privacyActive ? "page" : undefined}
      title={rowTitle(placement, "Privacidad")}
      className={rowClassName(placement, privacyActive ? "active" : "inactive")}
    >
      <RowIcon>
        <Shield className="h-5 w-5" aria-hidden="true" />
      </RowIcon>
      <RowLabel placement={placement}>Privacidad</RowLabel>
    </Link>
  )

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--shell-border)] pt-4">
      <div className={rowClassName(placement, "static")} title={rowTitle(placement, user.displayName)}>
        <RowIcon>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--shell-elevated)]">
            <User className="h-4 w-4" aria-hidden="true" />
          </span>
        </RowIcon>
        <RowLabel placement={placement}>
          <span className="block truncate font-medium text-[var(--shell-foreground)]">Hola, {user.displayName}</span>
          {user.email ? <span className="block truncate text-xs">{user.email}</span> : null}
        </RowLabel>
      </div>
      <nav aria-label="Cuenta y privacidad" className="flex flex-col gap-1">
        {placement.mobile ? <SheetClose asChild>{privacyLink}</SheetClose> : privacyLink}
        <Button
          type="button"
          variant="ghost"
          title={rowTitle(placement, "Configurar cookies")}
          onClick={openCookiePreferences}
          className={rowClassName(placement)}
        >
          <RowIcon>
            <Cookie className="h-5 w-5" aria-hidden="true" />
          </RowIcon>
          <RowLabel placement={placement}>Configurar cookies</RowLabel>
        </Button>
      </nav>
      <LogoutControl className="w-full">
        {({ isPending }) => (
          <Button
            type="submit"
            variant="ghost"
            disabled={isPending}
            title={rowTitle(placement, "Cerrar sesión")}
            className={rowClassName(placement)}
          >
            <RowIcon>
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </RowIcon>
            <RowLabel placement={placement}>{isPending ? "Cerrando sesión…" : "Cerrar sesión"}</RowLabel>
          </Button>
        )}
      </LogoutControl>
    </div>
  )
}

function readRailPreference() {
  try {
    return window.localStorage.getItem(RAIL_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

function writeRailPreference(expanded: boolean) {
  try {
    window.localStorage.setItem(RAIL_STORAGE_KEY, String(expanded))
  } catch {
    // The preference is a convenience; the rail still toggles for this page view.
  }
}

function AuthenticatedApplicationShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const pathname = usePathname()
  const { openPreferences } = usePrivacyConsent()
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)
  const previousPathnameRef = useRef(pathname)
  const [expanded, setExpanded] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setExpanded(readRailPreference())
  }, [])

  // Each destination starts at the top; the shell itself never remounts, so nothing else would reset it.
  useEffect(() => {
    if (previousPathnameRef.current === pathname) return
    previousPathnameRef.current = pathname
    window.scrollTo(0, 0)
  }, [pathname])

  function toggleRail() {
    const next = !expanded
    setExpanded(next)
    writeRailPreference(next)
  }

  function openCookiePreferencesFromDrawer() {
    // Close the drawer first so two modal surfaces are never stacked; focus returns to the drawer trigger.
    setMobileOpen(false)
    window.requestAnimationFrame(() => openPreferences(mobileTriggerRef.current))
  }

  const desktop: Placement = { mobile: false, expanded }
  const mobile: Placement = { mobile: true }

  return (
    <div className="dashboard-shell min-h-screen bg-[var(--shell-canvas)] text-[var(--shell-foreground)]">
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-[var(--shell-border)] bg-[color:var(--shell-surface)]/95 backdrop-blur-sm">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--shell-focus)] focus-visible:outline-none"
          >
            <Image src="/logo_keepel_grueso.svg" alt="" width={36} height={28} priority />
            <span className="text-xl font-semibold tracking-tight">Keepel</span>
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button ref={mobileTriggerRef} variant="outline" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Abrir navegación</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="dashboard-shell flex w-[min(20rem,88vw)] flex-col border-[var(--shell-border)] bg-[var(--shell-surface)] text-[var(--shell-foreground)]"
            >
              <SheetHeader className="text-left">
                <SheetTitle>Navegación de Keepel</SheetTitle>
                <SheetDescription className="sr-only">
                  Accede al dashboard, a tus vehículos, a la privacidad y a la sesión.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 flex flex-1 flex-col justify-between gap-6">
                <NavigationLinks placement={mobile} />
                <AccountControls
                  user={user}
                  placement={mobile}
                  openCookiePreferences={openCookiePreferencesFromDrawer}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <aside
        className={cn(
          "fixed top-16 bottom-0 left-0 z-30 hidden flex-col gap-4 overflow-y-auto border-r border-[var(--shell-border)] bg-[var(--shell-surface)] p-3 transition-[width] duration-200 motion-reduce:transition-none md:flex",
          expanded ? "w-20 lg:w-64" : "w-20"
        )}
      >
        <div className="flex flex-1 flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={toggleRail}
            aria-expanded={expanded}
            className={cn(rowClassName({ mobile: false, expanded: false }), "mt-2 hidden lg:flex")}
          >
            <RowIcon>
              {expanded ? (
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              )}
            </RowIcon>
            <span className="sr-only">{expanded ? "Contraer navegación" : "Expandir navegación"}</span>
          </Button>
          <NavigationLinks placement={desktop} />
        </div>
        <AccountControls user={user} placement={desktop} openCookiePreferences={() => openPreferences()} />
      </aside>

      <main
        id="main-content"
        className={cn(
          "min-w-0 pt-16 transition-[margin-left] duration-200 motion-reduce:transition-none md:ml-20",
          expanded && "lg:ml-64"
        )}
      >
        {children}
      </main>
    </div>
  )
}

/**
 * Wraps authenticated product views and authenticated Privacy in one persistent shell. Every other route, and any
 * route once the projection becomes anonymous, renders its own layout unchanged.
 */
export function AuthenticatedApplicationBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const authState = useAuthProjection()

  if (authState.status !== AUTH_STATE_STATUS.AUTHENTICATED || !isShellPath(pathname)) {
    return children
  }

  return (
    <AuthenticatedApplicationShell user={authState.user}>
      <ContextErrorBoundary
        key={pathname}
        fallback={
          <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12" role="alert">
            <div className="max-w-md text-center">
              <h1 className="text-xl font-semibold">No se pudo cargar esta vista</h1>
              <p className="mt-2 text-sm text-[var(--shell-muted)]">
                La navegación sigue disponible. Recarga la página para volver a intentarlo.
              </p>
              <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
                Recargar página
              </Button>
            </div>
          </section>
        }
      >
        {children}
      </ContextErrorBoundary>
    </AuthenticatedApplicationShell>
  )
}
