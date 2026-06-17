import {
  type MutationCtx,
  type QueryCtx,
  mutation,
  query,
} from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"

// Read-only: the user row for the current Clerk identity, or null. Safe in
// queries (doesn't write). Returns null when signed out or not yet provisioned.
export async function getUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique()
}

// Mutation-only: ensure a user row exists for the current identity (lazy
// provisioning on first authenticated write). Throws when signed out.
export async function requireUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("Not signed in.")
  const existing = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique()
  if (existing) return existing
  const id: Id<"users"> = await ctx.db.insert("users", {
    clerkId: identity.subject,
    email: identity.email ?? "",
  })
  return (await ctx.db.get(id))!
}

// Called by the client right after sign-in to provision the user row.
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const u = await requireUser(ctx)
    return { _id: u._id, email: u.email }
  },
})

// Current signed-in user (or null) — for the dashboard chrome.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const u = await getUser(ctx)
    return u ? { _id: u._id, email: u.email } : null
  },
})
