"use client"

import { SignInButton, useAuth } from "@clerk/nextjs"
import Link from "next/link"
import type { ReactNode } from "react"

import { trackSignupStarted } from "@/lib/analytics"

// Footer host-auth link: opens the Clerk sign-in modal when signed out, links
// to the dashboard when signed in. Styled by the `.footer-col` rules.
export function FooterAuthLink({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return <Link href="/dashboard">{children}</Link>
  }
  return (
    // Parent span catches the click (bubbling) to fire the funnel event,
    // independent of how SignInButton wires its child's onClick.
    <span onClick={trackSignupStarted} style={{ display: "contents" }}>
      <SignInButton
        mode="modal"
        forceRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/thanks"
      >
        <button type="button">{children}</button>
      </SignInButton>
    </span>
  )
}
