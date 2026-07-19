"use client"

import { useAuthProjection, useData } from "@/contexts"
import { Dashboard } from "@/components/dashboard/Dashboard"
import { LandingPage } from "@/components/home/LandingPage"
import { Layout } from "@/components/layout/Layout"
import { AUTH_STATE_STATUS } from "@/lib/auth/contracts"

export default function HomePage() {
  const authState = useAuthProjection()
  const { vehicles, maintenanceRecords, scheduledServices, isLoading: dataLoading } = useData()

  return (
    <Layout showHeader={true}>
      {authState.status === AUTH_STATE_STATUS.AUTHENTICATED ? (
        <Dashboard
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
