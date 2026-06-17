import { handleWebhookRequest } from "@transloadit/convex"
import { httpRouter } from "convex/server"

import { api, internal } from "./_generated/api"
import { httpAction } from "./_generated/server"

const http = httpRouter()

// Transloadit posts multipart/form-data with `transloadit` (JSON) + `signature`.
// The component verifies the signature and persists the result; we then
// finalize the recording (best-effort — the cron reconciler is the safety net).
http.route({
  path: "/transloadit/webhook",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handleWebhookRequest(request, {
      mode: "queue",
      runAction: async (args) => {
        const result = await ctx.runAction(api.transloadit.queueWebhook, args)
        try {
          await ctx.runMutation(internal.recordings.finalizeRecording, {
            assemblyId: result.assemblyId,
          })
        } catch {
          // reconciler will retry
        }
        return result
      },
    }),
  ),
})

export default http
