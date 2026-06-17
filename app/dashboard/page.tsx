import { HostHome } from "@/components/host/HostHome"

// Host home (protected by clerkMiddleware). Lists the signed-in host's events.
export default function DashboardHomePage() {
  return <HostHome />
}
