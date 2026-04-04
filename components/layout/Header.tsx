"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Car, User, LogOut, Plus, ChevronDown, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { useAuth, useData } from "@/contexts"

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  license_plate?: string
}

export function Header() {
  const { user, profile, isLoading: authLoading, isLoggingOut, signOut } = useAuth()
  const { vehicles } = useData()
  const [showVehiclesDropdown, setShowVehiclesDropdown] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()

  // Safety timeout: if logout takes more than 2 seconds, force redirect
  useEffect(() => {
    if (isLoggingOut) {
      const timeoutId = setTimeout(() => {
        window.location.replace("/auth/login")
      }, 2000)

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [isLoggingOut])

  const handleVehicleSelect = (vehicleId: string) => {
    router.push(`/vehicles/${vehicleId}/maintenance`)
    setShowVehiclesDropdown(false)
  }

  const handleSignOut = async () => {
    setShowUserDropdown(false)
    setMobileMenuOpen(false)
    await signOut()
  }

  // Mostrar pantalla de carga completa durante logout
  if (isLoggingOut) {
    return (
      <div className="bg-background/95 fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo_keepel_grueso.svg" alt="Keepel" className="h-12 w-12 animate-pulse" />
          <div className="flex flex-col items-center gap-2">
            <p className="text-foreground text-xl font-semibold">Cerrando sesión...</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:-0.3s]"></div>
            <div className="bg-primary h-2 w-2 animate-bounce rounded-full [animation-delay:-0.15s]"></div>
            <div className="bg-primary h-2 w-2 animate-bounce rounded-full"></div>
          </div>
        </div>
      </div>
    )
  }

  // Mostrar skeleton durante la carga inicial para evitar parpadeo
  if (authLoading) {
    return (
      <header className="border-border/50 fixed top-0 right-0 left-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          {/* Logo y nombre */}
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <img src="/logo_keepel_grueso.svg" alt="Keepel" className="h-8 w-8" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Keepel</h1>
          </Link>

          {/* Skeleton para el área de navegación */}
          <div className="flex items-center gap-4">
            <div className="hidden h-4 w-20 animate-pulse rounded-lg bg-slate-100 sm:block"></div>
            <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100"></div>
            <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100"></div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="border-border/50 fixed top-0 right-0 left-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex max-w-full items-center justify-between px-4 py-3 sm:py-4">
        {/* Logo y nombre */}
        <Link href="/" className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80">
          <img src="/logo_keepel_grueso.svg" alt="Keepel" className="h-10 w-10 sm:h-8 sm:w-8" />
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Keepel</h1>
        </Link>

        {/* Navegación del usuario autenticado */}
        {user ? (
          <>
            {/* Desktop Navigation */}
            <div className="hidden items-center gap-3 lg:flex">
              {/* Saludo al usuario */}
              <span className="text-muted-foreground text-sm">
                Hola, {profile?.full_name || user.email?.split("@")[0]}
              </span>

              {/* Dropdown de Vehículos */}
              <DropdownMenu modal={false} open={showVehiclesDropdown} onOpenChange={setShowVehiclesDropdown}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/vehicles")}
                    className="hover:bg-accent cursor-pointer"
                  >
                    <Car className="mr-2 h-4 w-4" />
                    Vehículo
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem asChild>
                    <Link href="/vehicles" className="cursor-pointer">
                      <Plus className="mr-2 h-4 w-4" />
                      Añadir Vehículo
                    </Link>
                  </DropdownMenuItem>

                  {vehicles.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Mis Vehículos</DropdownMenuLabel>
                    </>
                  )}

                  {vehicles.length > 0 ? (
                    vehicles.map((vehicle) => (
                      <DropdownMenuItem key={vehicle.id} asChild>
                        <Link href={`/vehicles/${vehicle.id}`} className="flex cursor-pointer items-center">
                          <Car className="text-muted-foreground mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {vehicle.make} {vehicle.model} {vehicle.year}
                            </span>
                            {vehicle.license_plate && (
                              <span className="text-muted-foreground text-xs">{vehicle.license_plate}</span>
                            )}
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      <span className="text-muted-foreground text-sm">No hay vehículos añadidos</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Dropdown del usuario */}
              <DropdownMenu modal={false} open={showUserDropdown} onOpenChange={setShowUserDropdown}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hover:bg-accent flex cursor-pointer items-center gap-2">
                    <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
                      <User className="text-primary h-4 w-4" />
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm leading-none font-medium">{profile?.full_name || "Usuario"}</p>
                      <p className="text-muted-foreground text-xs leading-none">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile Hamburger Menu */}
            <div className="flex items-center gap-2 lg:hidden">
              {/* Hamburger Menu */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Abrir menú</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[350px]">
                  <SheetHeader className="text-left">
                    <SheetTitle className="flex items-center gap-2">
                      <img src="/logo_keepel_grueso.svg" alt="Keepel" className="h-5 w-5" />
                      Keepel
                    </SheetTitle>
                  </SheetHeader>

                  <div className="mt-8 flex flex-col gap-6">
                    {/* User Info Section */}
                    <div className="border-border flex items-center gap-3 border-b pb-4">
                      <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
                        <User className="text-primary h-6 w-6" />
                      </div>
                      <div className="flex flex-col">
                        <p className="text-sm font-medium">{profile?.full_name || "Usuario"}</p>
                        <p className="text-muted-foreground text-xs">{user.email}</p>
                      </div>
                    </div>

                    {/* Vehicles Section */}
                    <div className="space-y-3">
                      <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                        Vehículos
                      </h3>
                      <SheetClose asChild>
                        <Link
                          href="/vehicles"
                          className="hover:bg-accent flex items-center gap-3 rounded-lg p-3 transition-colors"
                        >
                          <Plus className="text-primary h-5 w-5" />
                          <span className="text-sm font-medium">Añadir Vehículo</span>
                        </Link>
                      </SheetClose>

                      {vehicles.length > 0 ? (
                        <div className="space-y-1">
                          {vehicles.map((vehicle) => (
                            <SheetClose asChild key={vehicle.id}>
                              <Link
                                href={`/vehicles/${vehicle.id}`}
                                className="hover:bg-accent flex items-center gap-3 rounded-lg p-3 transition-colors"
                              >
                                <Car className="text-muted-foreground h-5 w-5" />
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">
                                    {vehicle.make} {vehicle.model}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {vehicle.year}
                                    {vehicle.license_plate && ` • ${vehicle.license_plate}`}
                                  </span>
                                </div>
                              </Link>
                            </SheetClose>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground px-3 text-sm">No hay vehículos añadidos</p>
                      )}
                    </div>

                    {/* Actions Section */}
                    <div className="border-border mt-auto space-y-2 border-t pt-4">
                      <Button
                        variant="ghost"
                        className="hover:bg-destructive/10 hover:text-destructive w-full justify-start gap-3"
                        onClick={handleSignOut}
                      >
                        <LogOut className="h-5 w-5" />
                        <span>Cerrar Sesión</span>
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </>
        ) : (
          /* Botones para usuarios no autenticados */
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs sm:h-9 sm:px-4 sm:text-sm" asChild>
              <Link href="/auth/login">Iniciar Sesión</Link>
            </Button>
            <Button size="sm" className="h-8 px-2 text-xs sm:h-9 sm:px-4 sm:text-sm" asChild>
              <Link href="/auth/signup">Registrarse</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
