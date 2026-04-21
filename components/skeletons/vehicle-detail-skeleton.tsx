"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function VehicleDetailSkeleton() {
  return (
    <div 
      className="container mx-auto px-4 py-8"
      aria-busy="true"
      role="status"
      aria-label="Cargando detalles del vehículo"
    >
      {/* Back Button Skeleton */}
      <Skeleton className="mb-4 h-10 w-40 rounded-lg" />

      {/* Vehicle Header Card Skeleton */}
      <Card className="mb-6">
        <CardHeader>
          <div className="space-y-4">
            {/* Vehicle Title Row */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-7 w-48" />
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <Skeleton className="h-5 w-14 rounded-md" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>

            {/* Button Row */}
            <div className="border-border/50 flex justify-end border-t pt-2">
              <Skeleton className="h-9 w-full rounded-lg sm:w-48" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Maintenance History Title Skeleton */}
      <div className="mb-6 space-y-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-7 w-56" />
        </div>
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Maintenance List Skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Description */}
              <Skeleton className="h-4 w-full" />
              
              {/* Cost and Mileage row */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>

              {/* Next Service Section */}
              <div className="border-border border-t pt-3">
                <Skeleton className="mb-2 h-4 w-28" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-32 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
              </div>

              {/* Notes Section */}
              <div className="border-border border-t pt-3">
                <Skeleton className="mb-1 h-4 w-12" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
