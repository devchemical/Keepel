"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// ── Internal context to share open state between Root and Trigger ──────────

interface DropdownMenuInternalContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownMenuInternalContext = React.createContext<DropdownMenuInternalContextValue | null>(null)

function useDropdownMenuInternal() {
  const context = React.useContext(DropdownMenuInternalContext)
  if (!context) {
    throw new Error("DropdownMenuTrigger must be used within DropdownMenu")
  }
  return context
}

// ── DropdownMenu wrapper (always controlled internally so the Trigger can toggle it) ──

function DropdownMenu({
  open: openProp,
  onOpenChange,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) {
        setInternalOpen(value)
      }
      onOpenChange?.(value)
    },
    [isControlled, onOpenChange]
  )

  return (
    <DropdownMenuInternalContext.Provider value={{ open, setOpen }}>
      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen} {...props}>
        {children}
      </DropdownMenuPrimitive.Root>
    </DropdownMenuInternalContext.Provider>
  )
}

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

// ── DropdownMenuTrigger (touch-scroll safe) ────────────────────────────────
// Radix opens the menu on pointerDown and calls preventDefault(), which blocks
// native scrolling on mobile. We intercept touch pointerDown in capture phase
// so Radix never sees it, then manually toggle the menu on pointerUp if the
// user did not scroll.

const DropdownMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ children, ...props }, forwardedRef) => {
  const { open, setOpen } = useDropdownMenuInternal()
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const touchStartPos = React.useRef<{ x: number; y: number } | null>(null)
  const hasScrolled = React.useRef(false)

  React.useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const SCROLL_THRESHOLD = 10

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return
      touchStartPos.current = { x: e.clientX, y: e.clientY }
      hasScrolled.current = false
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !touchStartPos.current) return
      const dx = Math.abs(e.clientX - touchStartPos.current.x)
      const dy = Math.abs(e.clientY - touchStartPos.current.y)
      if (dx > SCROLL_THRESHOLD || dy > SCROLL_THRESHOLD) {
        hasScrolled.current = true
      }
    }

    // Capture phase: stop Radix from receiving touch pointerDown so it cannot
    // call preventDefault() and block scrolling.
    const handleCapturePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return
      e.stopImmediatePropagation()

      touchStartPos.current = { x: e.clientX, y: e.clientY }
      hasScrolled.current = false
    }

    // On pointerUp, toggle the menu only when the user did not scroll.
    const handleCapturePointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return

      if (!hasScrolled.current) {
        setOpen(!open)
      }

      hasScrolled.current = false
      touchStartPos.current = null
    }

    wrapper.addEventListener("pointerdown", handlePointerDown)
    wrapper.addEventListener("pointermove", handlePointerMove)
    wrapper.addEventListener("pointerdown", handleCapturePointerDown, true)
    wrapper.addEventListener("pointerup", handleCapturePointerUp, true)

    return () => {
      wrapper.removeEventListener("pointerdown", handlePointerDown)
      wrapper.removeEventListener("pointermove", handlePointerMove)
      wrapper.removeEventListener("pointerdown", handleCapturePointerDown, true)
      wrapper.removeEventListener("pointerup", handleCapturePointerUp, true)
    }
  }, [open, setOpen])

  return (
    <div ref={wrapperRef} className="inline-block" style={{ touchAction: "pan-y" }}>
      <DropdownMenuPrimitive.Trigger ref={forwardedRef} data-slot="dropdown-menu-trigger" {...props}>
        {children}
      </DropdownMenuPrimitive.Trigger>
    </div>
  )
})
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName

// ── Remaining Radix exports (unchanged behaviour) ──────────────────────────

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      className={cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuGroup = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Group>
>(({ ...props }, ref) => <DropdownMenuPrimitive.Group ref={ref} data-slot="dropdown-menu-group" {...props} />)
DropdownMenuGroup.displayName = DropdownMenuPrimitive.Group.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
    variant?: "default" | "destructive"
  }
>(({ className, inset, variant = "default", ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    data-slot="dropdown-menu-item"
    data-inset={inset}
    data-variant={variant}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm transition-colors outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <CheckIcon className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm transition-colors outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <CircleIcon className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("bg-muted -mx-1 my-1 h-px", className)} {...props} />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
  )
)
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
}
