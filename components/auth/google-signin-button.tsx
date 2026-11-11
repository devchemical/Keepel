"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/ui/icons"
import { sanitizeInternalRedirect } from "@/lib/auth/redirects"

interface GoogleSignInButtonProps {
  redirectTo?: string
  className?: string
  children?: React.ReactNode
}

export function GoogleSignInButton({
  redirectTo = "/",
  className,
  children = "Continuar con Google",
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = new URLSearchParams({ redirectTo: sanitizeInternalRedirect(redirectTo) })
  const initiationUrl = `/auth/google?${searchParams.toString()}`

  useEffect(() => {
    // A back/forward cache restore keeps the clicked state; the redirect is no longer in progress.
    const resetLoading = () => setIsLoading(false)
    window.addEventListener("pageshow", resetLoading)
    return () => window.removeEventListener("pageshow", resetLoading)
  }, [])

  const handleGoogleSignIn = () => {
    setIsLoading(true)
  }

  return (
    <Button asChild variant="outline" className={className}>
      <a href={initiationUrl} onClick={handleGoogleSignIn} aria-busy={isLoading}>
        {isLoading ? (
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.google className="mr-2 h-4 w-4" />
        )}
        {children}
      </a>
    </Button>
  )
}
