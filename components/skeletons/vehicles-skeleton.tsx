"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function VehiclesSkeleton() {
  return (
    <div 
      className="container mx-auto px-4 py-8"
      aria-busy="true"
      role="status"
      aria-label="Cargando vehículos"
    >
      {/* Title Section Skeleton */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-80" />
      </div>

      {/* 3-column Vehicle Cards Grid Skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="mt-2 h-5 w-12 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Color row */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              
              {/* License plate row */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
              
              {/* Mileage row */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
              
              {/* VIN row */}
              <Skeleton className="h-3 w-40" />
              
              {/* Button */}
              <div className="pt-2">
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Vehicle Button Skeleton */}
      <div className="mt-6">
        <Skeleton className="h-10 w-full rounded-lg sm:w-40" />
      </div>
    </div>
  )
}
