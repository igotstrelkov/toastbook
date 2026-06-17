import { ConvexClientProvider } from "@/components/ConvexClientProvider"
import { Recorder } from "@/components/recorder/Recorder"

// Guest recorder route. Stage 1 ignores the slug (the action uses a hardcoded
// TEST_EVENT in `fields`); Stage 2 wires real slug → event lookup.
export default async function GuestRecorderPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <ConvexClientProvider>
      <Recorder slug={slug} />
    </ConvexClientProvider>
  )
}
