"use client"

/* eslint-disable no-console -- Development-only analytics warnings help catch instrumentation failures. */

import { useOpenPanel } from "@openpanel/nextjs"
import { useCallback, useRef } from "react"

interface TrackEventOptions {
  name: string
  properties?: Record<string, string | number | boolean | null>
}

// Safe wrapper for OpenPanel calls
function safeOpenPanelCall<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch (error) {
    // Silently fail to avoid blocking the app
    if (process.env.NODE_ENV === "development") {
      console.warn("OpenPanel tracking error:", error)
    }
    return undefined
  }
}

export function useAnalytics() {
  const op = useOpenPanel()
  const identifiedUsers = useRef<Set<string>>(new Set())

  const trackEvent = useCallback(
    (options: TrackEventOptions) => {
      safeOpenPanelCall(() => {
        op.track(options.name, options.properties)
      })
    },
    [op]
  )

  const trackButtonClick = useCallback(
    (buttonName: string, additionalProps?: Record<string, string | number | boolean | null>) => {
      safeOpenPanelCall(() => {
        op.track("button_click", {
          button_name: buttonName,
          ...additionalProps,
        })
      })
    },
    [op]
  )

  const trackPageView = useCallback(
    (pageName: string, additionalProps?: Record<string, string | number | boolean | null>) => {
      safeOpenPanelCall(() => {
        op.track("page_view", {
          page: pageName,
          ...additionalProps,
        })
      })
    },
    [op]
  )

  const trackFormSubmit = useCallback(
    (formName: string, additionalProps?: Record<string, string | number | boolean | null>) => {
      safeOpenPanelCall(() => {
        op.track("form_submit", {
          form_name: formName,
          ...additionalProps,
        })
      })
    },
    [op]
  )

  const trackVehicleAction = useCallback(
    (action: "add" | "edit" | "delete" | "view", vehicleId?: string) => {
      safeOpenPanelCall(() => {
        op.track("vehicle_action", {
          action,
          vehicle_id: vehicleId || null,
        })
      })
    },
    [op]
  )

  const trackMaintenanceAction = useCallback(
    (action: "add" | "edit" | "delete" | "view" | "complete", recordId?: string) => {
      safeOpenPanelCall(() => {
        op.track("maintenance_action", {
          action,
          record_id: recordId || null,
        })
      })
    },
    [op]
  )

  const trackAuthAction = useCallback(
    (action: "sign_in" | "sign_out" | "sign_up" | "error", method?: string) => {
      safeOpenPanelCall(() => {
        op.track("auth_action", {
          action,
          method: method || null,
        })
      })
    },
    [op]
  )

  const identifyUser = useCallback(
    (userId: string, properties?: Record<string, string | number | boolean>) => {
      // Prevent duplicate identify calls for the same user
      if (identifiedUsers.current.has(userId)) {
        return
      }

      safeOpenPanelCall(() => {
        op.identify({
          profileId: userId,
          ...properties,
        })
        identifiedUsers.current.add(userId)
      })
    },
    [op]
  )

  const resetIdentification = useCallback(() => {
    identifiedUsers.current.clear()
  }, [])

  return {
    trackEvent,
    trackButtonClick,
    trackPageView,
    trackFormSubmit,
    trackVehicleAction,
    trackMaintenanceAction,
    trackAuthAction,
    identifyUser,
    resetIdentification,
    op,
  }
}
