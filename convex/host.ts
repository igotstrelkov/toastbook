import { v } from "convex/values"

import { api, internal } from "./_generated/api"
import { action } from "./_generated/server"

// Server-defined step graphs for host event assets (DO NOT accept from client).
// Cover: resize → store to R2; Greeting: loudnorm→mp3 → store to R2.
//
// VERIFY (Transloadit robots evolve): /image/resize params (imagemagick_stack
// version, resize_strategy, format). Confirmed current default at build:
// imagemagick_stack v3.0.1. The audio path mirrors the verified guest pipeline.
const COVER_STEPS = {
  ":original": { robot: "/upload/handle" },
  resized: {
    use: ":original",
    robot: "/image/resize",
    imagemagick_stack: "v3.0.1",
    resize_strategy: "fit",
    width: 1600,
    height: 1600,
    format: "jpg",
  },
  stored: {
    use: "resized",
    robot: "/cloudflare/store",
    credentials: "toastbook",
    path: "events/${fields.eventId}/cover.jpg",
  },
} as const

const GREETING_STEPS = {
  ":original": { robot: "/upload/handle" },
  normalized: {
    use: ":original",
    robot: "/audio/encode",
    preset: "mp3",
    ffmpeg_stack: "v6.0.0",
    ffmpeg: { af: "loudnorm=I=-16:TP=-1.5:LRA=11" },
  },
  stored: {
    use: "normalized",
    robot: "/cloudflare/store",
    credentials: "toastbook",
    path: "events/${fields.eventId}/greeting.mp3",
  },
} as const

type AssemblyOptions = { params: string; signature: string; fields?: unknown }

// Sign upload options for a host event asset. Auth-gated: must own the event.
export const getEventAssetOptions = action({
  args: {
    eventId: v.id("events"),
    kind: v.union(v.literal("cover"), v.literal("greeting")),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ assemblyOptions: AssemblyOptions }> => {
    const allowed = await ctx.runQuery(api.events.ownsEvent, {
      eventId: args.eventId,
    })
    if (!allowed) throw new Error("Not allowed.")

    const steps = args.kind === "cover" ? COVER_STEPS : GREETING_STEPS
    const notifyUrl = `${process.env.CONVEX_SITE_URL}/transloadit/webhook`
    const assemblyOptions = await ctx.runAction(
      api.transloadit.createAssemblyOptions,
      {
        steps,
        fields: { eventId: args.eventId, kind: args.kind },
        notifyUrl,
      },
    )
    return { assemblyOptions }
  },
})

// After the host's upload encodes, read the stored key and attach it to the
// event. The host is present (unlike a guest), so this runs client-driven.
export const finalizeEventAsset = action({
  args: {
    eventId: v.id("events"),
    kind: v.union(v.literal("cover"), v.literal("greeting")),
    assemblyId: v.string(),
  },
  handler: async (ctx, { eventId, kind, assemblyId }): Promise<void> => {
    const allowed = await ctx.runQuery(api.events.ownsEvent, { eventId })
    if (!allowed) throw new Error("Not allowed.")

    // Pull the latest results straight from Transloadit, then read the key.
    await ctx
      .runAction(api.transloadit.refreshAssembly, { assemblyId })
      .catch(() => {})
    const results: Array<{ stepName?: string; sslUrl?: string }> =
      await ctx.runQuery(api.transloadit.listResults, { assemblyId })

    const sourceStep = kind === "cover" ? "resized" : "normalized"
    const row =
      results.find((r) => r.stepName === sourceStep) ??
      results.find((r) => r.stepName === "stored")
    const key = row?.sslUrl
      ? new URL(row.sslUrl).pathname.replace(/^\/+/, "")
      : undefined
    if (!key) throw new Error("Upload isn't ready yet.")

    await ctx.runMutation(internal.events.setAssetKey, { eventId, kind, key })
  },
})
