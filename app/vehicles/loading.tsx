import { VehiclesSkeleton } from "@/components/skeletons/vehicles-skeleton"
import { Layout } from "@/components/layout/Layout"

export default function VehiclesLoading() {
  return (
    <Layout showHeader={true}>
      <VehiclesSkeleton />
    </Layout>
  )
}
