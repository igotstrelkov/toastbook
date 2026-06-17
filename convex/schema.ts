import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

// Canonical schema (Stage 2). The Transloadit component keeps its own
// assemblies/results tables; `recordings` is the app-level view linking a
// stored result to an event, keyed on assemblyId for idempotent convergence.
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
  }).index("by_clerk_id", ["clerkId"]),

  events: defineTable({
    userId: v.optional(v.id("users")), // tightened to required in Stage 4
    title: v.string(),
    coupleNames: v.optional(v.string()),
    eventDate: v.string(), // ISO date
    coverKey: v.optional(v.string()), // R2 key
    greetingKey: v.optional(v.string()), // R2 key
    slug: v.string(), // unguessable capability token
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("closed"),
    ),
    isPaid: v.boolean(),
    stripeSessionId: v.optional(v.string()),
    guestCap: v.optional(v.number()), // abuse/cost ceiling (Stage 8), not a paywall
  })
    .index("by_user", ["userId"])
    .index("by_slug", ["slug"]),

  recordings: defineTable({
    eventId: v.id("events"),
    assemblyId: v.string(),
    guestName: v.optional(v.string()),
    originalKey: v.optional(v.string()), // R2 key
    normalizedKey: v.optional(v.string()), // R2 key (mp3) — player source
    durationSeconds: v.number(),
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
  })
    .index("by_event", ["eventId"])
    .index("by_assembly", ["assemblyId"]),
})
