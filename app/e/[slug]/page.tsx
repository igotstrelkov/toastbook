import { Recorder } from "@/components/recorder/Recorder"

// Guest recorder route (public — no auth). Convex is provided globally in the
// root layout.
export default async function GuestRecorderPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <Recorder slug={slug} />
}
