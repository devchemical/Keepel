"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { savePrivacyConsent } from "@/app/actions/privacy"
import { PrivacyConsentBanner } from "./privacy-consent-banner"
import { PrivacyPreferencesDialog } from "./privacy-preferences-dialog"
import type { PrivacyConsentChoice, PrivacyConsentState } from "@/lib/privacy/consent"

interface PrivacyConsentContextValue {
  consent: PrivacyConsentState
  openPreferences(): void
}

const PrivacyConsentContext = createContext<PrivacyConsentContextValue | null>(null)

interface ConsentProviderProps {
  children: ReactNode
  initialConsent: PrivacyConsentState
}

export function ConsentProvider({ children, initialConsent }: ConsentProviderProps) {
  const [consent, setConsent] = useState(initialConsent)
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveChoice = useCallback(async (choice: PrivacyConsentChoice, closePreferences = false) => {
    setIsPending(true)
    setError(null)

    try {
      const result = await savePrivacyConsent(choice)

      if (result.status === "error") {
        setError("No hemos podido guardar tu elección. Inténtalo de nuevo.")
        return
      }

      setConsent(result.consent)
      if (closePreferences) setIsPreferencesOpen(false)
    } catch {
      setError("No hemos podido guardar tu elección. Inténtalo de nuevo.")
    } finally {
      setIsPending(false)
    }
  }, [])

  const openPreferences = useCallback(() => {
    setError(null)
    setIsPreferencesOpen(true)
  }, [])

  const value = useMemo(() => ({ consent, openPreferences }), [consent, openPreferences])

  return (
    <PrivacyConsentContext.Provider value={value}>
      {children}
      {consent.preference === "unknown" && (
        <PrivacyConsentBanner
          error={error}
          isPending={isPending}
          onAccept={() => void saveChoice("accepted")}
          onReject={() => void saveChoice("rejected")}
        />
      )}
      <PrivacyPreferencesDialog
        error={error}
        isOpen={isPreferencesOpen}
        isPending={isPending}
        preference={consent.preference}
        onAccept={() => void saveChoice("accepted", true)}
        onClose={() => setIsPreferencesOpen(false)}
        onOpenChange={setIsPreferencesOpen}
        onReject={() => void saveChoice("rejected", true)}
      />
    </PrivacyConsentContext.Provider>
  )
}

export function usePrivacyConsent() {
  const context = useContext(PrivacyConsentContext)

  if (!context) {
    throw new Error("usePrivacyConsent must be used within ConsentProvider")
  }

  return context
}
