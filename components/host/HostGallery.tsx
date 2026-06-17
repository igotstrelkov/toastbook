"use client"

import { useAction, useQuery } from "convex/react"
import { type ReactNode, useRef, useState } from "react"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  Avatar,
  Eyebrow,
  fmtTime,
  IconCheck,
  IconPause,
  IconPlay,
  IconTrash,
  IconWave,
  IconX,
  Waveform,
} from "@/components/recorder/primitives"

type Recording = {
  _id: Id<"recordings">
  _creationTime: number
  guestName: string | null
  durationSeconds: number
  status: "processing" | "ready" | "failed"
  normalizedUrl: string | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function CoupleNames({ value }: { value: string }) {
  const parts = value.split(/\s*&\s*/)
  if (parts.length !== 2) return <>{value}</>
  return (
    <>
      {parts[0]}{" "}
      <span
        style={{
          fontStyle: "italic",
          fontFamily: "var(--font-newsreader, Georgia, serif)",
          color: "var(--aloud-accent)",
        }}
      >
        &amp;
      </span>{" "}
      {parts[1]}
    </>
  )
}

export function HostGallery({ eventId }: { eventId: Id<"events"> }) {
  const event = useQuery(api.events.getById, { eventId })
  const recordings = useQuery(api.recordings.listByEvent, { eventId }) as
    | Recording[]
    | undefined

  if (event === undefined || recordings === undefined) {
    return <Centered>Loading…</Centered>
  }
  if (event === null) {
    return <Centered>This event doesn&apos;t exist.</Centered>
  }

  const total = recordings.length
  const totalSecs = recordings.reduce((s, r) => s + r.durationSeconds, 0)

  return (
    <div
      className="aloud"
      style={{
        minHeight: "100dvh",
        background: "var(--aloud-paper)",
        color: "var(--aloud-ink)",
      }}
    >
      <div style={{ maxWidth: 940, margin: "0 auto", padding: "30px 28px 70px" }}>
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 20,
            marginBottom: 26,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Eyebrow>Voice guestbook</Eyebrow>
            <h1
              style={{
                fontFamily: "var(--font-newsreader, Georgia, serif)",
                fontWeight: 400,
                fontSize: 40,
                letterSpacing: "-0.018em",
                margin: "8px 0 8px",
              }}
            >
              <CoupleNames value={event.coupleNames ?? event.title} />
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                color: "var(--aloud-ink-soft)",
                fontSize: 13.5,
              }}
            >
              <span style={{ fontFamily: "var(--font-space-mono, monospace)" }}>
                {formatDate(event.eventDate)}
              </span>
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 99,
                  background: "var(--aloud-ink-faint)",
                }}
              />
              <span
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <span
                  className="rec-dot"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    background: "var(--aloud-accent)",
                  }}
                />{" "}
                Collecting live
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 26, textAlign: "right" }}>
            <Stat n={String(total)} label="Messages" />
            <Stat n={fmtTime(totalSecs)} label="Recorded" mono />
          </div>
        </div>

        {/* toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            margin: "0 0 12px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-newsreader, Georgia, serif)",
              fontSize: 22,
            }}
          >
            All messages
          </span>
          <span
            style={{
              fontFamily: "var(--font-space-mono, monospace)",
              fontSize: 13,
              color: "var(--aloud-ink-faint)",
            }}
          >
            {total}
          </span>
        </div>

        {/* rows */}
        <div
          style={{
            background: "var(--aloud-paper)",
            border: "1.4px solid var(--aloud-line)",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          {recordings.map((r, i) => (
            <RecRow key={r._id} r={r} last={i === recordings.length - 1} />
          ))}
          {total === 0 && (
            <div
              style={{
                padding: 44,
                textAlign: "center",
                color: "var(--aloud-ink-faint)",
              }}
            >
              <IconWave size={22} style={{ color: "var(--aloud-accent)" }} />
              <p style={{ marginTop: 10, fontSize: 14 }}>
                No messages yet — share your link and they&apos;ll appear here
                live.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ n, label, mono }: { n: string; label: string; mono?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontFamily: mono
            ? "var(--font-space-mono, monospace)"
            : "var(--font-newsreader, Georgia, serif)",
          fontSize: 30,
          lineHeight: 1,
        }}
      >
        {n}
      </div>
      <Eyebrow style={{ fontSize: 9, marginTop: 6 }}>{label}</Eyebrow>
    </div>
  )
}

function RecRow({ r, last }: { r: Recording; last: boolean }) {
  const del = useAction(api.r2.deleteRecording)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const name = r.guestName?.trim()
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "15px 18px",
        borderBottom: last ? "none" : "1px solid var(--aloud-line)",
        opacity: deleting ? 0.5 : 1,
      }}
    >
      <Avatar name={name || "Anonymous"} size={42} />
      <div style={{ width: 180, flexShrink: 0, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontSize: 18,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: name ? "var(--aloud-ink)" : "var(--aloud-ink-faint)",
          }}
        >
          {name || "Anonymous"}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--aloud-ink-faint)",
            marginTop: 2,
          }}
        >
          {ago(r._creationTime)}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {r.status === "ready" && r.normalizedUrl ? (
          <RowPlayer url={r.normalizedUrl} seed={r._id} duration={r.durationSeconds} />
        ) : r.status === "failed" ? (
          <span style={{ fontSize: 13, color: "var(--aloud-ink-faint)" }}>
            Couldn&apos;t process this message.
          </span>
        ) : (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--aloud-ink-faint)",
            }}
          >
            <span
              className="rec-dot"
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: "var(--aloud-accent)",
              }}
            />
            Processing…
          </span>
        )}
      </div>

      {confirming ? (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <IconBtn
            label="Confirm delete"
            onClick={() => {
              setDeleting(true)
              void del({ recordingId: r._id }).catch(() => setDeleting(false))
            }}
            accent
          >
            <IconCheck size={16} />
          </IconBtn>
          <IconBtn label="Cancel" onClick={() => setConfirming(false)}>
            <IconX size={16} />
          </IconBtn>
        </div>
      ) : (
        <IconBtn
          label="Delete message"
          onClick={() => setConfirming(true)}
          disabled={deleting}
        >
          <IconTrash size={17} />
        </IconBtn>
      )}
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  label,
  accent,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  label: string
  accent?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      style={{
        flexShrink: 0,
        padding: 9,
        borderRadius: 10,
        cursor: disabled ? "default" : "pointer",
        border: "none",
        background: accent ? "var(--aloud-accent)" : "transparent",
        color: accent ? "var(--aloud-accent-ink)" : "var(--aloud-ink-soft)",
        boxShadow: accent ? "none" : "inset 0 0 0 1.3px var(--aloud-line)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  )
}

// Real inline player — plays normalizedUrl (mp3) only; waveform syncs to the
// audio clock. NEVER renders for non-ready recordings (hard rule 3).
function RowPlayer({
  url,
  seed,
  duration,
}: {
  url: string
  seed: string
  duration: number
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(duration)
  const progress = dur ? t / dur : 0

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) a.pause()
    else void a.play().catch(() => {})
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (isFinite(d) && d > 0) setDur(d)
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false)
          setT(0)
        }}
      />
      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          flexShrink: 0,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: playing ? "var(--aloud-accent)" : "var(--aloud-ink)",
          color: playing ? "var(--aloud-accent-ink)" : "var(--aloud-paper)",
        }}
      >
        {playing ? <IconPause size={15} /> : <IconPlay size={15} style={{ marginLeft: 2 }} />}
      </button>
      <div style={{ flex: 1, minWidth: 0, color: "var(--aloud-ink-faint)" }}>
        <Waveform
          seed={seed}
          n={48}
          progress={progress}
          played="var(--aloud-accent)"
          height={26}
          barW={2.5}
          onSeek={(p) => {
            const a = audioRef.current
            if (a && dur) a.currentTime = p * dur
            setT(p * dur)
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-space-mono, monospace)",
          fontSize: 12.5,
          color: "var(--aloud-ink-soft)",
          flexShrink: 0,
        }}
      >
        {fmtTime(playing ? t : dur)}
      </span>
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div
      className="aloud"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--aloud-paper)",
        color: "var(--aloud-ink-soft)",
        fontFamily: "var(--font-hanken, system-ui)",
      }}
    >
      {children}
    </div>
  )
}
