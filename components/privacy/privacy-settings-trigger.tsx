"use client"

import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { usePrivacyConsent } from "./consent-provider"

export function PrivacySettingsTrigger(props: Omit<ComponentProps<typeof Button>, "onClick">) {
  const { openPreferences } = usePrivacyConsent()

  return <Button type="button" {...props} onClick={(event) => openPreferences(event.currentTarget)} />
}
