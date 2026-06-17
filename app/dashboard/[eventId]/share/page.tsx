import { ShareEvent } from "@/components/host/ShareEvent"
import type { Id } from "@/convex/_generated/dataModel"

// Share screen (protected by clerkMiddleware; ownership-gated server-side).
export default async function ShareEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  return <ShareEvent eventId={eventId as Id<"events">} />
}
