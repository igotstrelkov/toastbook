"use client"

import { SignOutButton } from "@clerk/nextjs"
import { useQuery } from "convex/react"
import Link from "next/link"

import { IconWave } from "@/components/recorder/primitives"
import { api } from "@/convex/_generated/api"
import { useStoreUser } from "@/hooks/use-store-user"
import type { CSSProperties } from "react"
import { Centered } from "./ShareEvent"

const createBtn: CSSProperties = {
  textDecoration: "none",
  border: "none",
  borderRadius: 999,
  padding: "12px 20px",
  fontFamily: "var(--font-hanken, system-ui)",
  fontWeight: 600,
  fontSize: 14,
  background: "var(--aloud-accent)",
  color: "var(--aloud-accent-ink)",
  display: "inline-block",
}

const signOutBtn: CSSProperties = {
  border: "1.4px solid var(--aloud-line)",
  background: "var(--aloud-paper)",
  borderRadius: 999,
  padding: "11px 18px",
  fontFamily: "var(--font-hanken, system-ui)",
  fontWeight: 600,
  fontSize: 14,
  color: "var(--aloud-ink-soft)",
  cursor: "pointer",
}

// Host home — the post-sign-in landing. Lists the host's guestbooks (event
// creation lands in Stage 5; until then this is empty unless you've claimed
// the seeded test event).
export function HostHome() {
  const { ready } = useStoreUser()
  const events = useQuery(api.events.listMine, ready ? {} : "skip")

  if (!ready || events === undefined) {
    return <Centered>Loading…</Centered>
  }

  return (
    <main
      className="aloud"
      style={{
        minHeight: "100dvh",
        background: "var(--aloud-paper)",
        color: "var(--aloud-ink)",
      }}
    >
      <div
        style={{ maxWidth: 720, margin: "0 auto", padding: "48px 28px 70px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          <div>
            {/* <Eyebrow>Your guestbooks</Eyebrow> */}
            <h1
              style={{
                fontFamily: "var(--font-newsreader, Georgia, serif)",
                fontWeight: 400,
                fontSize: 38,
                letterSpacing: "-0.018em",
                margin: "8px 0 0",
              }}
            >
              Welcome back.
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SignOutButton redirectUrl="/">
              <button style={signOutBtn}>Sign out</button>
            </SignOutButton>
            <Link href="/dashboard/new" style={createBtn}>
              + Create a guestbook
            </Link>
          </div>
        </div>

        {events.length === 0 ? (
          <div
            style={{
              border: "1.4px solid var(--aloud-line)",
              borderRadius: 18,
              padding: 40,
              textAlign: "center",
              color: "var(--aloud-ink-faint)",
            }}
          >
            <IconWave size={22} style={{ color: "var(--aloud-accent)" }} />
            <p style={{ marginTop: 10, marginBottom: 16, fontSize: 14 }}>
              No guestbooks yet.
            </p>
            <Link href="/dashboard/new" style={createBtn}>
              + Create a guestbook
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {events.map((e) => (
              <Link
                key={e._id}
                href={`/dashboard/${e._id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "18px 22px",
                  border: "1.4px solid var(--aloud-line)",
                  borderRadius: 18,
                  textDecoration: "none",
                  color: "var(--aloud-ink)",
                  background: "var(--aloud-paper)",
                }}
              >
                <span>
                  <span
                    style={{
                      fontFamily: "var(--font-newsreader, Georgia, serif)",
                      fontSize: 22,
                    }}
                  >
                    {e.coupleNames ?? e.title}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontFamily: "var(--font-space-mono, monospace)",
                      fontSize: 12,
                      color: "var(--aloud-ink-faint)",
                      marginTop: 2,
                    }}
                  >
                    {e.eventDate} · {e.status}
                  </span>
                </span>
                <span style={{ color: "var(--aloud-ink-soft)", fontSize: 14 }}>
                  Open →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
