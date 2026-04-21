"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function HeaderSkeleton() {
  return (
    <header 
      className="border-border/50 fixed top-0 right-0 left-0 z-50 border-b bg-white/80 backdrop-blur-md"
      aria-busy="true"
      role="status"
      aria-label="Cargando navegación"
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        {/* Logo skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-7 w-20" />
        </div>

        {/* Navigation skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="hidden h-4 w-20 sm:block" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </header>
  )
}
