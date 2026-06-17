import { v } from "convex/values"

import { api } from "./_generated/api"
import { action } from "./_generated/server"

// Server-defined step graph — DO NOT accept steps from the client (hard rule 2).
// loudnorm → mp3, and store both the original and normalized outputs to
// Cloudflare R2 under unguessable keys via the `toastbook` credential.
//
// Uses the R2-native /cloudflare/store robot (NOT /s3/store): /s3/store forces
// S3 region semantics and defaults to us-east-1, which R2 rejects; the
// Cloudflare robot resolves the bucket/region from the R2 credential.
//
// VERIFY (Transloadit robots evolve): /audio/encode `ffmpeg.af` loudnorm syntax,
// the `ffmpeg_stack` version, and `path` var syntax.
const GUEST_AUDIO_STEPS = {
  ":original": { robot: "/upload/handle" },
  normalized: {
    use: ":original",
    robot: "/audio/encode",
    preset: "mp3",
    ffmpeg_stack: "v6.0.0",
    ffmpeg: { af: "loudnorm=I=-16:TP=-1.5:LRA=11" }, // EBU R128
  },
  stored_original: {
    use: ":original",
    robot: "/cloudflare/store",
    credentials: "toastbook",
    path: "events/${fields.eventId}/${assembly.id}/original.${file.ext}",
  },
  stored_normalized: {
    use: "normalized",
    robot: "/cloudflare/store",
    credentials: "toastbook",
    path: "events/${fields.eventId}/${assembly.id}/normalized.mp3",
  },
} as const

// Stage 1: hardcoded TEST_EVENT in fields (real slug lookup lands in Stage 2).
// Returns signed assembly options for the client's Uppy uploader — the auth
// secret never leaves the server.
// Explicit return type breaks the circular type inference Convex hits when a
// function references `api` and is itself part of `api`.
type AssemblyOptions = { params: string; signature: string; fields?: unknown }

export const getGuestAssemblyOptions = action({
  args: { guestName: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ assemblyOptions: AssemblyOptions }> => {
    const notifyUrl = `${process.env.CONVEX_SITE_URL}/transloadit/webhook`
    const assemblyOptions = await ctx.runAction(
      api.transloadit.createAssemblyOptions,
      {
        steps: GUEST_AUDIO_STEPS,
        fields: { eventId: "TEST_EVENT", guestName: args.guestName ?? "" },
        notifyUrl,
      },
    )
    return { assemblyOptions }
  },
})
