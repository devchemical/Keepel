"use client"

import { useAuthProjection, useData } from "@/contexts"
import { DataRecovery } from "@/components/data/data-recovery"
import { Dashboard } from "@/components/dashboard/Dashboard"
import { LandingPage } from "@/components/home/LandingPage"
import { Layout } from "@/components/layout/Layout"
import { AUTH_STATE_STATUS } from "@/lib/auth/contracts"
import { snapshotView } from "@/lib/data/snapshot-machine"

export default function HomePage() {
  const authState = useAuthProjection()
  const { vehicles, maintenanceRecords, scheduledServices, snapshot } = useData()
  const view = snapshotView(snapshot)

  return (
    <Layout showHeader={true}>
      {authState.status === AUTH_STATE_STATUS.AUTHENTICATED ? (
        <div data-snapshot-status={snapshot.status}>
          <div className="container mx-auto px-4 pt-8">
            <DataRecovery />
          </div>
          {view === "blockingError" ? null : (
            <Dashboard
              vehicles={vehicles}
              maintenanceRecords={maintenanceRecords}
              upcomingMaintenance={scheduledServices}
              isLoading={view === "skeleton"}
            />
          )}
        </div>
      ) : (
        <LandingPage />
      )}
    </Layout>
  )
}
