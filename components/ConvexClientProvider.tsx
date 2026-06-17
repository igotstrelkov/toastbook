"use client"

import { useAuth } from "@clerk/nextjs"
import { ConvexReactClient } from "convex/react"
import { ConvexProviderWithClerk } from "convex/react-clerk"
import { type ReactNode } from "react"

// Global Convex client wired to Clerk auth. Signed-out visitors (guests) still
// call PUBLIC functions fine — no token is sent, which is exactly what guest
// endpoints expect (hard rule 2). Host endpoints read the identity for gating.
// Must be mounted inside <ClerkProvider> (see app/layout.tsx).
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
