"use client"

import { useQuery } from "convex/react"

import { ConvexClientProvider } from "@/components/ConvexClientProvider"
import { api } from "@/convex/_generated/api"

function HealthCheck() {
  const health = useQuery(api.health.get)

  return (
    <main style={{ padding: 24, fontFamily: "monospace", lineHeight: 1.6 }}>
      <h1>Convex health check</h1>
      <p>{health ? "✅ Convex is live" : "⏳ Connecting…"}</p>
      <pre>{health ? JSON.stringify(health, null, 2) : null}</pre>
    </main>
  )
}

export default function HealthPage() {
  return (
    <ConvexClientProvider>
      <HealthCheck />
    </ConvexClientProvider>
  )
}
