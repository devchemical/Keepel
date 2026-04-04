"use client"

import * as React from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface ResponsiveDialogProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface ResponsiveDialogContentProps {
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
}

interface ResponsiveDialogTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

const ResponsiveDialogContext = React.createContext<{
  isDesktop: boolean
}>({ isDesktop: true })

export function ResponsiveDialog({ children, open, onOpenChange }: ResponsiveDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  return (
    <ResponsiveDialogContext.Provider value={{ isDesktop }}>
      {isDesktop ? (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      ) : (
        <Sheet open={open} onOpenChange={onOpenChange}>
          {children}
        </Sheet>
      )}
    </ResponsiveDialogContext.Provider>
  )
}

export function ResponsiveDialogTrigger({ children, asChild }: ResponsiveDialogTriggerProps) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext)

  return isDesktop ? (
    <DialogTrigger asChild={asChild}>{children}</DialogTrigger>
  ) : (
    <SheetTrigger asChild={asChild}>{children}</SheetTrigger>
  )
}

export function ResponsiveDialogContent({ children, className, title, description }: ResponsiveDialogContentProps) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext)

  if (isDesktop) {
    return (
      <DialogContent className={className}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    )
  }

  // Mobile: Full-screen Bottom Sheet
  return (
    <SheetContent
      side="bottom"
      className={cn("flex h-auto max-h-[100dvh] flex-col rounded-t-[20px] p-0", className)}
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <div className="bg-muted mx-auto mt-4 mb-4 h-1.5 w-12 flex-shrink-0 rounded-full" />

      {(title || description) && (
        <SheetHeader className="flex-shrink-0 px-4 pb-4">
          {title && <SheetTitle className="text-xl">{title}</SheetTitle>}
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </SheetContent>
  )
}

export function ResponsiveDialogHeader({ children }: { children: React.ReactNode }) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext)

  return isDesktop ? <DialogHeader>{children}</DialogHeader> : <SheetHeader>{children}</SheetHeader>
}

export function ResponsiveDialogTitle({ children }: { children: React.ReactNode }) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext)

  return isDesktop ? <DialogTitle>{children}</DialogTitle> : <SheetTitle>{children}</SheetTitle>
}

export function ResponsiveDialogDescription({ children }: { children: React.ReactNode }) {
  const { isDesktop } = React.useContext(ResponsiveDialogContext)

  return isDesktop ? <DialogDescription>{children}</DialogDescription> : <SheetDescription>{children}</SheetDescription>
}
