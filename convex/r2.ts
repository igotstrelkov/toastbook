"use node"

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { v } from "convex/values"

import { internal } from "./_generated/api"
import { action } from "./_generated/server"

// R2 object deletion (hard rule 7: deletion purges both R2 objects by key).
// Node action because the AWS SDK is node-only. Stored keys already include the
// bucket-name prefix (a /cloudflare/store quirk), so they're used verbatim.
function r2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

async function deleteKeys(keys: (string | null | undefined)[]) {
  const bucket = process.env.R2_BUCKET
  const s3 = r2Client()
  for (const key of keys) {
    if (!key) continue
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    } catch {
      // best-effort; a missing object is fine
    }
  }
}

export const deleteRecording = action({
  args: { recordingId: v.id("recordings") },
  handler: async (ctx, { recordingId }) => {
    const rec = await ctx.runQuery(internal.recordings.getRecording, {
      recordingId,
    })
    if (!rec) return
    await deleteKeys([rec.originalKey, rec.normalizedKey])
    await ctx.runMutation(internal.recordings.removeRecording, { recordingId })
  },
})

export const deleteEvent = action({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const recs = await ctx.runQuery(internal.recordings.recordingsForEvent, {
      eventId,
    })
    const eventKeys = await ctx.runQuery(internal.events.getKeysInternal, {
      eventId,
    })
    await deleteKeys([
      ...recs.flatMap((r) => [r.originalKey, r.normalizedKey]),
      eventKeys.coverKey,
      eventKeys.greetingKey,
    ])
    await ctx.runMutation(internal.recordings.removeEvent, { eventId })
  },
})
