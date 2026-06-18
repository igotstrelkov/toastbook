import Link from "next/link"
import type { ReactNode } from "react"

// Small back/breadcrumb link for host sub-pages.
export function BackLink({
  href,
  children = "Back",
}: {
  href: string
  children?: ReactNode
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13.5,
        fontFamily: "var(--font-hanken, system-ui)",
        color: "var(--aloud-ink-soft)",
        textDecoration: "none",
        marginBottom: 20,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
        ←
      </span>{" "}
      {children}
    </Link>
  )
}
