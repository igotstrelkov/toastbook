"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

import { trackSignupCompleted } from "@/lib/analytics"

// Post-signup confirmation. Counting the conversion on this page load (rather
// than a button click) ensures only COMPLETED signups are counted. Fires once.
export default function ThanksPage() {
  const firedRef = useRef(false)
  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    trackSignupCompleted()
  }, [])

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        padding: 24,
        textAlign: "center",
        background: "var(--aloud-paper)",
        color: "var(--aloud-ink)",
      }}
    >
      <div className="eyebrow" style={{ color: "var(--aloud-ink-faint)" }}>
        You&apos;re in
      </div>
      <h1
        style={{
          fontFamily: "var(--font-newsreader, Georgia, serif)",
          fontWeight: 400,
          fontSize: 46,
          letterSpacing: "-0.018em",
          margin: 0,
        }}
      >
        Welcome to Toastbook.
      </h1>
      <p
        style={{
          fontSize: 16,
          lineHeight: 1.55,
          color: "var(--aloud-ink-soft)",
          maxWidth: 340,
          margin: 0,
        }}
      >
        Your account is ready. Create your first guestbook and start collecting
        voices from your day.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
        <Link
          href="/dashboard/new"
          style={{
            textDecoration: "none",
            border: "none",
            borderRadius: 999,
            padding: "14px 24px",
            fontFamily: "var(--font-hanken, system-ui)",
            fontWeight: 600,
            fontSize: 15,
            background: "var(--aloud-accent)",
            color: "var(--aloud-accent-ink)",
          }}
        >
          + Create a guestbook
        </Link>
        <Link
          href="/"
          style={{
            textDecoration: "none",
            border: "1.4px solid var(--aloud-line)",
            borderRadius: 999,
            padding: "14px 24px",
            fontFamily: "var(--font-hanken, system-ui)",
            fontWeight: 600,
            fontSize: 15,
            color: "var(--aloud-ink)",
          }}
        >
          Back home
        </Link>
      </div>
    </main>
  )
}
