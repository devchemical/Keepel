import { VehicleDetailSkeleton } from "@/components/skeletons/vehicle-detail-skeleton"
import { Layout } from "@/components/layout/Layout"

export default function VehicleMaintenanceLoading() {
  return (
    <Layout showHeader={true}>
      <VehicleDetailSkeleton />
    </Layout>
  )
}
