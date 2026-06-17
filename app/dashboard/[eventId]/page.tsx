import { ConvexClientProvider } from "@/components/ConvexClientProvider"
import { HostGallery } from "@/components/host/HostGallery"
import type { Id } from "@/convex/_generated/dataModel"

// Host gallery (Stage 3). Not auth-gated yet — Stage 4 adds Clerk + ownership;
// until then the eventId in the URL acts as the capability token.
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  return (
    <ConvexClientProvider>
      <HostGallery eventId={eventId as Id<"events">} />
    </ConvexClientProvider>
  )
}
