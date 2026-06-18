"use client"

import { SignInButton, useAuth } from "@clerk/nextjs"
import Link from "next/link"
import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"

type ButtonProps = ComponentProps<typeof Button>

// Landing CTA → host entry. Signed in: links straight to the dashboard. Signed
// out (or still loading): opens the Clerk sign-in modal, which force-redirects
// to /dashboard afterwards.
export function CreateGuestbookButton({
  children = "Create your guestbook",
  ...props
}: Omit<ButtonProps, "asChild" | "onClick">) {
  const { isSignedIn } = useAuth()

  if (isSignedIn) {
    return (
      <Button asChild {...props}>
        <Link href="/dashboard">{children}</Link>
      </Button>
    )
  }

  return (
    <SignInButton
      mode="modal"
      forceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
    >
      <Button type="button" {...props}>
        {children}
      </Button>
    </SignInButton>
  )
}
