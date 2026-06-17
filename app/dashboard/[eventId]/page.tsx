import { HostGallery } from "@/components/host/HostGallery"
import type { Id } from "@/convex/_generated/dataModel"

// Host gallery — protected by clerkMiddleware (signed-out → /sign-in) and
// gated server-side by event ownership. Convex is provided globally.
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  return <HostGallery eventId={eventId as Id<"events">} />
}
