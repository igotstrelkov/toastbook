import type { Metadata } from "next"
import type { ReactNode } from "react"

// Auth route — keep out of search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function SignInLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
