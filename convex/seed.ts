import { internalMutation } from "./_generated/server"

// Dev helper: remove recordings created by CLI smoke tests (assemblyId starts
// with "smoke-test") so the reconciler doesn't churn on bogus assemblies.
export const clearTestRecordings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("recordings").collect()
    let n = 0
    for (const r of rows) {
      if (r.assemblyId.startsWith("smoke-test")) {
        await ctx.db.delete(r._id)
        n++
      }
    }
    return n
  },
})

// One-off seed: an active test event at slug `maya-and-theo` (matches the
// recorder route used in dev). Idempotent. Run: `npx convex run seed:seed`.
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const slug = "maya-and-theo"
    const existing = await ctx.db
      .query("events")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique()
    if (existing) return existing._id
    return await ctx.db.insert("events", {
      title: "Maya & Theo's Wedding",
      coupleNames: "Maya & Theo",
      eventDate: "2026-09-14",
      slug,
      status: "active",
      isPaid: false,
    })
  },
})
