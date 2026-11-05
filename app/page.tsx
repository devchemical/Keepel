"use client"

import { useAuthProjection, useData } from "@/contexts"
import { DataRecovery } from "@/components/data/data-recovery"
import { Dashboard } from "@/components/dashboard/Dashboard"
import { LandingPage } from "@/components/home/LandingPage"
import { Layout } from "@/components/layout/Layout"
import { AUTH_STATE_STATUS } from "@/lib/auth/contracts"

export default function HomePage() {
  const authState = useAuthProjection()
  const { vehicles, maintenanceRecords, scheduledServices, isLoading: dataLoading, hasLoaded, loadError } = useData()

  return (
    <Layout showHeader={true}>
      {authState.status === AUTH_STATE_STATUS.AUTHENTICATED ? (
        <>
          <DataRecovery />
          {hasLoaded || !loadError ? (
            <Dashboard
              vehicles={vehicles}
              maintenanceRecords={maintenanceRecords}
              upcomingMaintenance={scheduledServices}
              isLoading={dataLoading && !hasLoaded}
            />
          ) : null}
        </>
      ) : (
        <LandingPage />
      )}
    </Layout>
  )
}
