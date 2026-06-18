"use client"

import { SignInButton, useAuth } from "@clerk/nextjs"
import Link from "next/link"
import type { ReactNode } from "react"

// Footer host-auth link: opens the Clerk sign-in modal when signed out, links
// to the dashboard when signed in. Styled by the `.footer-col` rules.
export function FooterAuthLink({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return <Link href="/dashboard">{children}</Link>
  }
  return (
    <SignInButton
      mode="modal"
      forceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
    >
      <button type="button">{children}</button>
    </SignInButton>
  )
}
