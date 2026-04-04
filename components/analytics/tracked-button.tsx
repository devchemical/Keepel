"use client"

import * as React from "react"
import type { buttonVariants } from "@/components/ui/button"
import { Button } from "@/components/ui/button"
import { useAnalytics } from "@/hooks/use-analytics"
import { type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

interface TrackedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  trackName: string
  trackProperties?: Record<string, string | number | boolean | null>
}

const TrackedButton = React.forwardRef<HTMLButtonElement, TrackedButtonProps>(
  ({ className, variant, size, asChild = false, trackName, trackProperties, onClick, ...props }, ref) => {
    const { trackButtonClick } = useAnalytics()

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      trackButtonClick(trackName, trackProperties)
      onClick?.(e)
    }

    return (
      <Button
        className={className}
        variant={variant}
        size={size}
        asChild={asChild}
        onClick={handleClick}
        ref={ref}
        {...props}
      />
    )
  }
)
TrackedButton.displayName = "TrackedButton"

export { TrackedButton }
