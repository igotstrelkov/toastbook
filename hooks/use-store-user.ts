"use client"

import { useConvexAuth, useMutation } from "convex/react"
import { useEffect, useState } from "react"

import { api } from "@/convex/_generated/api"

// Provisions the Convex `users` row for the signed-in Clerk identity (lazy
// upsert), following Convex's "store users in the database" pattern. Returns
// `ready` — true only once the user is signed in AND the row exists — which
// host pages gate their queries on, so they render Loading → final state with
// no empty-then-populated flicker.
//
// (More robust long-term: provision via a Clerk `user.created` webhook so the
// row exists server-side regardless of the client. This client-side approach
// is the documented MVP path.)
export function useStoreUser() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const ensureUser = useMutation(api.users.ensureUser)
  const [stored, setStored] = useState(false)

  useEffect(() => {
    // `ready` masks a stale `stored` via the && below, so no reset needed here.
    if (!isAuthenticated) return
    let active = true
    void ensureUser({})
      .catch(() => {})
      .finally(() => {
        if (active) setStored(true)
      })
    return () => {
      active = false
    }
  }, [isAuthenticated, ensureUser])

  return { isLoading, isAuthenticated, ready: isAuthenticated && stored }
}
