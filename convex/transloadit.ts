import { makeTransloaditAPI } from "@transloadit/convex"

import { components } from "./_generated/api"

// Re-export only the component functions we use. Each re-export becomes a
// PUBLIC Convex endpoint, so we keep the surface minimal:
//   createAssemblyOptions — sign assembly options server-side (guest.ts)
//   queueWebhook          — durable webhook ingestion (http.ts)
//   listResults           — read stored outputs (recorder panel; Stage 2 finalize)
//   refreshAssembly /
//   getAssemblyStatus     — Stage 2 cron reconciler (finalize/fail stuck rows)
// The auth secret stays server-side; the client only receives signed options.
// (Component-wide auth/rate-limiting hardening lands in Stage 8.)
export const {
  createAssemblyOptions,
  queueWebhook,
  refreshAssembly,
  getAssemblyStatus,
  listResults,
} = makeTransloaditAPI(components.transloadit)
