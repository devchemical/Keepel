"use client"

import { Dashboard } from "@/components/dashboard/Dashboard"
import { LandingPage } from "@/components/home/LandingPage"
import { Layout } from "@/components/layout/Layout"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { useAuth, useData } from "@/contexts"

export default function HomePage() {
  const { user, profile, isLoading: authLoading, signOut } = useAuth()
  const { vehicles, maintenanceRecords, scheduledServices, isLoading: dataLoading, refreshAll } = useData()

  // Show loading screen only during initial auth check to prevent flash
  const showLoadingScreen = authLoading

  // Production ready - no debug logging

  // Show loading screen during initial auth verification
  if (showLoadingScreen) {
    return <LoadingScreen message="Verificando autenticación..." />
  }

  // Renderizado condicional basado en autenticación
  return (
    <Layout showHeader={true}>
      {user ? (
        <Dashboard
          user={user}
          profile={profile}
          vehicles={vehicles}
          maintenanceRecords={maintenanceRecords}
          upcomingMaintenance={scheduledServices}
          isLoading={dataLoading}
        />
      ) : (
        <LandingPage />
      )}
    </Layout>
  )
}
