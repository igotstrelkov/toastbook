"use client"

import { ConvexProvider, ConvexReactClient } from "convex/react"
import { type ReactNode, useState } from "react"

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

// Stage 0 provider. Scoped to routes that need Convex (e.g. /health) so the
// marketing pages keep working before the deployment URL is set. Stage 4 will
// promote this to a global ConvexProviderWithClerk in the root layout.
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() =>
    convexUrl ? new ConvexReactClient(convexUrl) : null,
  )

  if (!client) {
    return (
      <main style={{ padding: 24, fontFamily: "monospace", lineHeight: 1.6 }}>
        <strong>NEXT_PUBLIC_CONVEX_URL is not set.</strong>
        <br />
        Run <code>npx convex dev</code> to create the project and populate{" "}
        <code>.env.local</code>, then reload.
      </main>
    )
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>
}
