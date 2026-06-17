import { v } from "convex/values"

import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server"

// The stored object key is the path portion of the result's R2 sslUrl, e.g.
// https://toastbook.<acct>.r2.cloudflarestorage.com/toastbook/events/…/x.mp3
// → toastbook/events/…/x.mp3  (the bucket-name prefix is /cloudflare/store's).
function keyFromSslUrl(sslUrl: unknown): string | undefined {
  if (typeof sslUrl !== "string") return undefined
  try {
    return new URL(sslUrl).pathname.replace(/^\/+/, "")
  } catch {
    return undefined
  }
}

type ResultRow = { stepName?: string; sslUrl?: string }

/**
 * Optimistic insert from the client (hard rule 8: NOT authoritative — may never
 * fire if the tab closes). Idempotent upsert by assemblyId.
 */
export const registerRecording = mutation({
  args: {
    slug: v.string(),
    assemblyId: v.string(),
    guestName: v.optional(v.string()),
    durationSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (!event || event.status !== "active") {
      throw new Error("This guestbook isn't available.")
    }

    const existing = await ctx.db
      .query("recordings")
      .withIndex("by_assembly", (q) => q.eq("assemblyId", args.assemblyId))
      .unique()
    if (existing) return existing._id // converges with the webhook

    return await ctx.db.insert("recordings", {
      eventId: event._id,
      assemblyId: args.assemblyId,
      guestName: args.guestName?.trim() || undefined,
      durationSeconds: args.durationSeconds,
      status: "processing",
    })
  },
})

/**
 * Authoritative finalize (hard rule 8). Reads the component's stored results;
 * upserts the row by assemblyId — creating it from the assembly `fields` if the
 * client never registered. Idempotent. Only marks `failed` on a terminal
 * assembly state with no usable output (left for the reconciler/webhook).
 */
export const finalizeRecording = internalMutation({
  args: { assemblyId: v.string() },
  handler: async (ctx, { assemblyId }) => {
    const existing = await ctx.db
      .query("recordings")
      .withIndex("by_assembly", (q) => q.eq("assemblyId", assemblyId))
      .unique()
    if (existing?.status === "ready") return // idempotent

    const results: ResultRow[] = await ctx.runQuery(
      api.transloadit.listResults,
      { assemblyId },
    )
    const find = (s: string) => results.find((r) => r.stepName === s)
    const normalizedKey = keyFromSslUrl(
      (find("normalized") ?? find("stored_normalized"))?.sslUrl,
    )
    const originalKey = keyFromSslUrl(
      (find(":original") ?? find("stored_original"))?.sslUrl,
    )

    if (normalizedKey) {
      if (existing) {
        await ctx.db.patch(existing._id, {
          normalizedKey,
          originalKey: originalKey ?? existing.originalKey,
          status: "ready",
        })
      } else {
        // Lost-recording recovery: rebuild from the assembly's fields.
        const asm = await ctx.runQuery(api.transloadit.getAssemblyStatus, {
          assemblyId,
        })
        const fields = asm?.fields ?? asm?.raw?.fields ?? {}
        if (!fields.eventId) return
        await ctx.db.insert("recordings", {
          eventId: fields.eventId as Id<"events">,
          assemblyId,
          guestName: fields.guestName || undefined,
          normalizedKey,
          originalKey,
          durationSeconds: 0, // unknown without the client timer
          status: "ready",
        })
      }
      return
    }

    // No output yet — fail only if the assembly is terminally done/errored.
    if (existing) {
      const asm = await ctx.runQuery(api.transloadit.getAssemblyStatus, {
        assemblyId,
      })
      const ok = asm?.ok ?? asm?.raw?.ok
      const err = asm?.error ?? asm?.raw?.error
      if (err || ok === "ASSEMBLY_COMPLETED") {
        await ctx.db.patch(existing._id, { status: "failed" })
      }
    }
  },
})

/**
 * Reactive read for the host gallery (Stage 3). Derives `normalizedUrl` only
 * when ready; NEVER returns an originalUrl for the player (hard rule 3).
 */
export const listByEvent = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const base = process.env.MEDIA_BASE_URL
    const recs = await ctx.db
      .query("recordings")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .order("desc")
      .collect()
    return recs.map((r) => ({
      _id: r._id,
      _creationTime: r._creationTime,
      guestName: r.guestName ?? null,
      durationSeconds: r.durationSeconds,
      status: r.status,
      normalizedUrl:
        r.status === "ready" && r.normalizedKey && base
          ? `${base}/${r.normalizedKey}`
          : null,
    }))
  },
})

// ── delete helpers (R2 object deletion lives in the node action r2.ts) ──
export const getRecording = internalQuery({
  args: { recordingId: v.id("recordings") },
  handler: (ctx, { recordingId }) => ctx.db.get(recordingId),
})

export const removeRecording = internalMutation({
  args: { recordingId: v.id("recordings") },
  handler: async (ctx, { recordingId }) => {
    await ctx.db.delete(recordingId)
  },
})

export const recordingsForEvent = internalQuery({
  args: { eventId: v.id("events") },
  handler: (ctx, { eventId }) =>
    ctx.db
      .query("recordings")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect(),
})

// Cascade-deletes an event's recording rows + the event row (R2 objects are
// purged first by the r2.deleteEvent action — hard rule 7).
export const removeEvent = internalMutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const recs = await ctx.db
      .query("recordings")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect()
    for (const r of recs) await ctx.db.delete(r._id)
    await ctx.db.delete(eventId)
  },
})

// Rows stuck in `processing` past the grace window — the reconciler's worklist.
export const staleProcessing = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30_000
    const rows = await ctx.db.query("recordings").collect()
    return rows
      .filter((r) => r.status === "processing" && r._creationTime < cutoff)
      .slice(0, 50)
      .map((r) => ({ assemblyId: r.assemblyId }))
  },
})

/**
 * Safety-net cron (runs regardless of the webhook). Refreshes each stale
 * assembly straight from Transloadit, then finalizes/fails it.
 */
export const reconcile = internalAction({
  args: {},
  handler: async (ctx) => {
    const stale = await ctx.runQuery(internal.recordings.staleProcessing, {})
    for (const { assemblyId } of stale) {
      try {
        await ctx.runAction(api.transloadit.refreshAssembly, { assemblyId })
      } catch {
        // best-effort refresh; finalize still runs against stored state
      }
      await ctx.runMutation(internal.recordings.finalizeRecording, {
        assemblyId,
      })
    }
  },
})
