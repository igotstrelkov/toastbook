"use client"

import { useMutation } from "convex/react"
import { useRouter } from "next/navigation"
import { type CSSProperties, useState } from "react"

import { BackLink } from "@/components/host/BackLink"
import { Btn, IconArrow } from "@/components/recorder/primitives"
import { api } from "@/convex/_generated/api"
import { useStoreUser } from "@/hooks/use-store-user"

const inputStyle: CSSProperties = {
  fontFamily: "var(--font-hanken, system-ui)",
  fontSize: 15.5,
  color: "var(--aloud-ink)",
  background: "var(--aloud-paper)",
  border: "1.4px solid var(--aloud-line)",
  borderRadius: 11,
  padding: "13px 15px",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
}

const labelStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--aloud-ink-soft)",
  marginBottom: 7,
  display: "block",
}

export function CreateEvent() {
  const { ready } = useStoreUser()
  const create = useMutation(api.events.createEvent)
  const router = useRouter()

  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const [date, setDate] = useState("")
  const [busy, setBusy] = useState(false)

  const canSubmit =
    ready &&
    a.trim().length > 0 &&
    b.trim().length > 0 &&
    date.trim().length > 0 &&
    !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    try {
      const { eventId } = await create({
        partnerA: a,
        partnerB: b,
        eventDate: date,
      })
      router.push(`/dashboard/${eventId}/share`)
    } catch {
      setBusy(false)
    }
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
        style={{ maxWidth: 560, margin: "0 auto", padding: "48px 28px 70px" }}
      >
        <BackLink href="/dashboard">Your guestbooks</BackLink>
        {/* <Eyebrow>New event</Eyebrow> */}
        <h1
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontWeight: 400,
            fontSize: 42,
            letterSpacing: "-0.018em",
            margin: "14px 0 8px",
          }}
        >
          Create your guestbook.
        </h1>
        <p
          style={{
            fontSize: 15.5,
            color: "var(--aloud-ink-soft)",
            marginBottom: 34,
          }}
        >
          A few details and your guests can start recording.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div>
            <label style={labelStyle}>Partner one</label>
            <input
              style={inputStyle}
              value={a}
              maxLength={40}
              onChange={(e) => setA(e.target.value)}
              placeholder="Maya"
            />
          </div>
          <div>
            <label style={labelStyle}>Partner two</label>
            <input
              style={inputStyle}
              value={b}
              maxLength={40}
              onChange={(e) => setB(e.target.value)}
              placeholder="Theo"
            />
          </div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <label style={labelStyle}>Wedding date</label>
          <input
            type="date"
            style={inputStyle}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <p
          style={{
            fontSize: 12.5,
            color: "var(--aloud-ink-faint)",
            marginBottom: 24,
          }}
        >
          A cover photo and a recorded welcome are coming soon.
        </p>

        <Btn
          variant="accent"
          size="lg"
          block
          disabled={!canSubmit}
          onClick={submit}
        >
          {busy ? "Creating…" : "Create event"} <IconArrow size={18} />
        </Btn>
      </div>
    </main>
  )
}
