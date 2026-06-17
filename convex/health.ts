import { query } from "./_generated/server"

// Trivial reactive query to prove the Convex deployment is live (Stage 0).
// `_generated/` is created when you run `npx convex dev`.
export const get = query({
  args: {},
  handler: async () => ({
    status: "ok",
    service: "toastbook-convex",
    serverTime: Date.now(),
  }),
})
