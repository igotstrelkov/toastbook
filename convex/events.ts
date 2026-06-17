import { v } from "convex/values"

import { internalQuery, mutation, query } from "./_generated/server"
import { getUser, requireUser } from "./users"

// Public, guest-callable. Returns ONLY display fields for an ACTIVE event, and
// nothing for a missing/non-active slug (no data leak — hard rule 2). URLs are
// derived from stored keys on read (hard rule 4).
export const getEventBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique()
    if (!event || event.status !== "active") return null

    const base = process.env.MEDIA_BASE_URL
    const url = (key?: string) => (key && base ? `${base}/${key}` : null)
    return {
      _id: event._id,
      title: event.title,
      coupleNames: event.coupleNames ?? null,
      eventDate: event.eventDate,
      coverUrl: url(event.coverKey),
      greetingUrl: url(event.greetingKey),
      status: event.status,
    }
  },
})

// Host dashboard read (by id, any status). Auth-gated: only the owning host
// (Stage 4). Returns null for signed-out / non-owner / missing.
export const getById = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const user = await getUser(ctx)
    if (!user) return null
    const event = await ctx.db.get(eventId)
    if (!event || event.userId !== user._id) return null
    const base = process.env.MEDIA_BASE_URL
    return {
      _id: event._id,
      title: event.title,
      coupleNames: event.coupleNames ?? null,
      eventDate: event.eventDate,
      status: event.status,
      isPaid: event.isPaid,
      slug: event.slug,
      coverUrl:
        event.coverKey && base ? `${base}/${event.coverKey}` : null,
    }
  },
})

// Ownership check for the current identity — used by the delete actions.
export const ownsEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const user = await getUser(ctx)
    if (!user) return false
    const event = await ctx.db.get(eventId)
    return !!event && event.userId === user._id
  },
})

// Claim an UNOWNED event as the current host. Real ownership is set at creation
// in Stage 5; this safely lets a host adopt the seeded test event. Refuses to
// take over an already-owned event.
export const claimEvent = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const user = await requireUser(ctx)
    const event = await ctx.db.get(eventId)
    if (!event) throw new Error("Event not found.")
    if (event.userId && event.userId !== user._id) {
      throw new Error("This event already belongs to someone else.")
    }
    await ctx.db.patch(eventId, { userId: user._id })
    return user._id
  },
})

// Internal: cover/greeting keys for cascade deletion.
export const getKeysInternal = internalQuery({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId)
    return {
      coverKey: event?.coverKey ?? null,
      greetingKey: event?.greetingKey ?? null,
    }
  },
})
