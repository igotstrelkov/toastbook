import { v } from "convex/values"

import { internalQuery, query } from "./_generated/server"

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

// Host dashboard read (by id, any status). NOT auth-gated yet — Stage 4 adds
// ownership checks; until then the eventId acts as the capability.
export const getById = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const event = await ctx.db.get(eventId)
    if (!event) return null
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
