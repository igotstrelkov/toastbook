import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

// Safety net for the webhook (hard rule 8): finalize/fail any recording stuck
// in `processing` past the grace window, straight from Transloadit.
crons.interval(
  "reconcile recordings",
  { seconds: 60 },
  internal.recordings.reconcile,
  {},
)

export default crons
