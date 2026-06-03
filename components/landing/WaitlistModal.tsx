"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { Dialog, VisuallyHidden } from "radix-ui"
import { Waitlist } from "@clerk/nextjs"
import { X } from "lucide-react"

interface WaitlistContextValue {
  open: () => void
}

const WaitlistContext = createContext<WaitlistContextValue | null>(null)

export function useWaitlist(): WaitlistContextValue {
  const ctx = useContext(WaitlistContext)
  if (!ctx) {
    throw new Error("useWaitlist must be used within <WaitlistProvider>")
  }
  return ctx
}

export function WaitlistProvider({
  children,
  clerkEnabled,
}: {
  children: ReactNode
  /** True when a Clerk publishable key is configured. Gates the real form. */
  clerkEnabled: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <WaitlistContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="waitlist-overlay" />
          <Dialog.Content className="waitlist-content">
            <VisuallyHidden.Root>
              <Dialog.Title>Join the waitlist</Dialog.Title>
              <Dialog.Description>
                Be the first to know when Aloud opens.
              </Dialog.Description>
            </VisuallyHidden.Root>
            <Dialog.Close className="waitlist-close" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
            {clerkEnabled ? (
              <Waitlist />
            ) : (
              <div className="waitlist-fallback">
                <h2>Join the waitlist</h2>
                <p>
                  The waitlist isn&apos;t live yet. Add your Clerk keys to
                  <code> .env.local</code> to enable sign-ups.
                </p>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </WaitlistContext.Provider>
  )
}
