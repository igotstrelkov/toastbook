import { handleWebhookRequest } from "@transloadit/convex"
import { httpRouter } from "convex/server"

import { api } from "./_generated/api"
import { httpAction } from "./_generated/server"

const http = httpRouter()

// Transloadit posts multipart/form-data with `transloadit` (JSON) + `signature`.
// The component verifies the signature and durably queues the result; our
// finalizeRecording (Stage 2) reconciles it into the recordings table.
http.route({
  path: "/transloadit/webhook",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handleWebhookRequest(request, {
      mode: "queue",
      runAction: (args) => ctx.runAction(api.transloadit.queueWebhook, args),
    }),
  ),
})

export default http
