import type { Metadata } from "next"
import type { ReactNode } from "react"

// Post-signup confirmation — keep out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ThanksLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
