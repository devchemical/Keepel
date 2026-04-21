"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function MaintenanceSkeleton() {
  return (
    <div 
      className="space-y-4"
      aria-busy="true"
      role="status"
      aria-label="Cargando mantenimientos"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-28" />
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
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>

            {/* Next Service Section */}
            <div className="border-border border-t pt-3">
              <Skeleton className="mb-2 h-4 w-32" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-36 rounded-full" />
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
