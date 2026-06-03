"use client"

import { Button } from "@/components/ui/button"
import { useWaitlist } from "@/components/landing/WaitlistModal"
import type { ComponentProps } from "react"

type ButtonProps = ComponentProps<typeof Button>

export function CreateGuestbookButton({
  children = "Create your guestbook",
  ...props
}: Omit<ButtonProps, "asChild" | "onClick">) {
  const { open } = useWaitlist()
  return (
    <Button type="button" onClick={open} {...props}>
      {children}
    </Button>
  )
}
