"use client"

import Uppy from "@uppy/core"
import Transloadit, { type AssemblyOptions } from "@uppy/transloadit"
import { useAction } from "convex/react"
import { useCallback, useRef, useState } from "react"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  Eyebrow,
  extFromMime,
  fmtTime,
  IconCheck,
  IconMic,
  IconPause,
  IconPlay,
  IconRedo,
  LevelMeter,
  pickMimeType,
  useInterval,
} from "@/components/recorder/primitives"

const CAP = 30 // seconds — a short welcome

type Phase = "idle" | "recording" | "preview" | "uploading"

// Host records a short welcome that guests hear on the recorder cover. Reuses
// the recorder's audio capture + the host event-asset upload (kind:"greeting").
export function GreetingRecorder({
  eventId,
  greetingUrl,
}: {
  eventId: Id<"events">
  greetingUrl: string | null
}) {
  const getOptions = useAction(api.host.getEventAssetOptions)
  const finalize = useAction(api.host.finalizeEventAsset)

  const [phase, setPhase] = useState<Phase>("idle")
  const [elapsed, setElapsed] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const elapsedRef = useRef(0)
  const blobRef = useRef<Blob | null>(null)
  const mrRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useInterval(
    () => {
      const n = +(elapsedRef.current + 0.1).toFixed(1)
      elapsedRef.current = n
      setElapsed(n)
      if (n >= CAP) stop()
    },
    phase === "recording" ? 100 : null,
  )

  const start = useCallback(async () => {
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || mimeType || "audio/webm",
        })
        blobRef.current = blob
        setPreviewUrl((p) => {
          if (p) URL.revokeObjectURL(p)
          return URL.createObjectURL(blob)
        })
        stopStream()
      }
      mr.start()
      mrRef.current = mr
      elapsedRef.current = 0
      setElapsed(0)
      setPhase("recording")
    } catch {
      setErr("Microphone access is needed.")
    }
  }, [stopStream])

  function stop() {
    const mr = mrRef.current
    if (mr && mr.state !== "inactive") mr.stop()
    setPhase("preview")
  }

  async function send() {
    const blob = blobRef.current
    if (!blob) return
    setPhase("uploading")
    setErr(null)
    const uppy = new Uppy({ autoProceed: false }).use(Transloadit, {
      waitForEncoding: true,
      assemblyOptions: async () => {
        const { assemblyOptions } = await getOptions({ eventId, kind: "greeting" })
        return assemblyOptions as unknown as AssemblyOptions
      },
    })
    try {
      const ext = extFromMime(blob.type)
      uppy.addFile({ name: `greeting.${ext}`, type: blob.type, data: blob })
      const result = (await uppy.upload()) as {
        transloadit?: Array<{ assembly_id?: string }>
      }
      const assemblyId = result?.transloadit?.[0]?.assembly_id
      if (!assemblyId) throw new Error("no assembly")
      await finalize({ eventId, kind: "greeting", assemblyId })
      // reactive getById updates greetingUrl → falls back to the saved state
      setPhase("idle")
      setPreviewUrl((p) => {
        if (p) URL.revokeObjectURL(p)
        return null
      })
    } catch {
      setErr("Upload failed — please try again.")
      setPhase("preview")
    } finally {
      uppy.destroy()
    }
  }

  return (
    <div
      style={{
        border: "1.4px solid var(--aloud-line)",
        borderRadius: 18,
        padding: 18,
        marginBottom: 22,
        display: "flex",
        alignItems: "center",
        gap: 14,
        minHeight: 76,
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <Eyebrow style={{ fontSize: 9 }}>A hello from you</Eyebrow>
        <div
          style={{
            fontSize: 13.5,
            color: "var(--aloud-ink-soft)",
            marginTop: 4,
            maxWidth: 180,
          }}
        >
          {err ?? "A short welcome guests hear first."}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
        {phase === "idle" &&
          (greetingUrl ? (
            <GreetingPlayer url={greetingUrl} onRedo={start} />
          ) : (
            <Pill onClick={start}>
              <IconMic size={15} /> Record
            </Pill>
          ))}

        {phase === "recording" && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LevelMeter active bars={16} color="var(--aloud-accent)" height={24} />
            <span
              style={{
                fontFamily: "var(--font-space-mono, monospace)",
                fontSize: 13,
              }}
            >
              {fmtTime(elapsed)}
            </span>
            <Pill accent onClick={stop}>
              Stop
            </Pill>
          </div>
        )}

        {phase === "preview" && previewUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <audio src={previewUrl} controls style={{ height: 34, maxWidth: 200 }} />
            <Pill onClick={start}>
              <IconRedo size={14} /> Redo
            </Pill>
            <Pill accent onClick={send}>
              <IconCheck size={14} /> Keep
            </Pill>
          </div>
        )}

        {phase === "uploading" && (
          <span style={{ fontSize: 13, color: "var(--aloud-ink-faint)" }}>
            Saving…
          </span>
        )}
      </div>
    </div>
  )
}

function GreetingPlayer({ url, onRedo }: { url: string; onRedo: () => void }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <audio
        ref={ref}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={() => {
          const a = ref.current
          if (!a) return
          if (playing) a.pause()
          else void a.play().catch(() => {})
        }}
        aria-label={playing ? "Pause" : "Play greeting"}
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: playing ? "var(--aloud-accent)" : "var(--aloud-ink)",
          color: playing ? "var(--aloud-accent-ink)" : "var(--aloud-paper)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {playing ? <IconPause size={15} /> : <IconPlay size={15} style={{ marginLeft: 2 }} />}
      </button>
      <Pill onClick={onRedo}>
        <IconRedo size={14} /> Re-record
      </Pill>
    </div>
  )
}

function Pill({
  children,
  onClick,
  accent,
}: {
  children: React.ReactNode
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        border: accent ? "none" : "1.4px solid var(--aloud-line)",
        background: accent ? "var(--aloud-accent)" : "var(--aloud-paper)",
        color: accent ? "var(--aloud-accent-ink)" : "var(--aloud-ink)",
        borderRadius: 999,
        padding: "9px 15px",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "var(--font-hanken, system-ui)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {children}
    </button>
  )
}
