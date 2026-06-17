"use client"

import Uppy from "@uppy/core"
import Transloadit, { type AssemblyOptions } from "@uppy/transloadit"
import { useAction, useQuery } from "convex/react"
import { useCallback, useEffect, useRef, useState } from "react"

import { api } from "@/convex/_generated/api"

const MAX_SECONDS = 60

type Phase = "idle" | "recording" | "recorded" | "uploading" | "done"

// iOS Safari yields audio/mp4; Chrome/Firefox yield audio/webm. Pick whatever
// the device supports; never assume.
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  for (const c of ["audio/mp4", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return undefined
}

function extFromMime(mime: string): string {
  if (mime.includes("mp4")) return "m4a"
  if (mime.includes("ogg")) return "ogg"
  return "webm"
}

function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function Recorder({ slug }: { slug: string }) {
  const getAssemblyOptions = useAction(api.guest.getGuestAssemblyOptions)

  const [phase, setPhase] = useState<Phase>("idle")
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0)
  const [guestName, setGuestName] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [assemblyId, setAssemblyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recordedBlobRef = useRef<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const meterRafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const startMsRef = useRef<number>(0)

  const stopCapture = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current)
      meterRafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setLevel(0)
  }, [])

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== "inactive") mr.stop()
    stopCapture()
  }, [stopCapture])

  const beginMeterAndTimer = useCallback(
    (stream: MediaStream) => {
      startMsRef.current = performance.now()
      timerRef.current = window.setInterval(() => {
        const sec = (performance.now() - startMsRef.current) / 1000
        setElapsed(sec)
        if (sec >= MAX_SECONDS) stopRecording()
      }, 100)

      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = ctx
      const data = new Uint8Array(analyser.frequencyBinCount)
      const loop = () => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3))
        meterRafRef.current = requestAnimationFrame(loop)
      }
      loop()
    },
    [stopRecording],
  )

  // Mic permission MUST be requested inside the tap handler (iOS blocks it
  // otherwise).
  const startRecording = useCallback(async () => {
    setError(null)
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
        const type = mr.mimeType || mimeType || "audio/webm"
        const blob = new Blob(chunksRef.current, { type })
        recordedBlobRef.current = blob
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        setPhase("recorded")
      }
      mr.start()
      mediaRecorderRef.current = mr
      setElapsed(0)
      setPhase("recording")
      beginMeterAndTimer(stream)
    } catch {
      setError(
        "Microphone access is needed to record. Please allow it in your browser and try again.",
      )
      stopCapture()
      setPhase("idle")
    }
  }, [beginMeterAndTimer, stopCapture])

  const reRecord = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    recordedBlobRef.current = null
    setElapsed(0)
    setError(null)
    setPhase("idle")
  }, [])

  const send = useCallback(async () => {
    const blob = recordedBlobRef.current
    if (!blob) return
    setError(null)
    setPhase("uploading")
    const uppy = new Uppy({ autoProceed: false }).use(Transloadit, {
      waitForEncoding: true,
      assemblyOptions: async () => {
        const { assemblyOptions } = await getAssemblyOptions({
          guestName: guestName.trim() || undefined,
        })
        return assemblyOptions as unknown as AssemblyOptions
      },
    })
    try {
      const ext = extFromMime(blob.type)
      uppy.addFile({ name: `message.${ext}`, type: blob.type, data: blob })
      const result = (await uppy.upload()) as {
        transloadit?: Array<{ assembly_id?: string }>
      }
      const id = result?.transloadit?.[0]?.assembly_id ?? null
      // The webhook is authoritative; we capture assemblyId only to show the
      // result in this temporary Stage 1 panel.
      setAssemblyId(id)
      setPhase("done")
    } catch {
      setError("Upload failed. Please check your connection and try again.")
      setPhase("recorded")
    } finally {
      uppy.destroy()
    }
  }, [getAssemblyOptions, guestName])

  useEffect(() => {
    return () => {
      stopCapture()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const accent = "var(--aloud-accent)"
  const capped = elapsed >= MAX_SECONDS

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
        textAlign: "center",
        background: "var(--aloud-paper-2)",
        color: "var(--aloud-ink)",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div
          className="eyebrow"
          style={{ marginBottom: 8 }}
        >
          Leave a message
        </div>
        <h1
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontSize: 34,
            lineHeight: 1.05,
            margin: "0 0 6px",
          }}
        >
          Record your voice
        </h1>
        <p style={{ color: "var(--aloud-ink-soft)", margin: "0 0 28px" }}>
          Up to 60 seconds. Tap, talk, and send — no app needed.
        </p>

        {/* timer + level meter */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "var(--font-space-mono, monospace)",
              fontSize: 40,
              letterSpacing: "-0.02em",
              color: capped ? accent : "var(--aloud-ink)",
            }}
          >
            {fmt(elapsed)}{" "}
            <span style={{ fontSize: 16, color: "var(--aloud-ink-faint)" }}>
              / 1:00
            </span>
          </div>
          <div
            aria-hidden="true"
            style={{
              height: 8,
              borderRadius: 999,
              background: "var(--aloud-line)",
              overflow: "hidden",
              marginTop: 10,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(phase === "recording" ? level : 0) * 100}%`,
                background: accent,
                transition: "width 80ms linear",
              }}
            />
          </div>
        </div>

        {phase === "idle" && (
          <button onClick={startRecording} style={primaryBtn}>
            ● Record your message
          </button>
        )}

        {phase === "recording" && (
          <button onClick={stopRecording} style={primaryBtn}>
            ■ Stop recording
          </button>
        )}

        {phase === "recorded" && previewUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Local preview MAY use the in-memory blob (hard rule 3 only
                governs the gallery player). */}
            <audio src={previewUrl} controls style={{ width: "100%" }} />
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your name (optional)"
              style={textInput}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={reRecord} style={ghostBtn}>
                Re-record
              </button>
              <button onClick={send} style={primaryBtn}>
                Send ›
              </button>
            </div>
          </div>
        )}

        {phase === "uploading" && (
          <p style={{ color: "var(--aloud-ink-soft)" }}>
            Uploading and processing your message…
          </p>
        )}

        {phase === "done" && (
          <div>
            <p style={{ fontSize: 18, marginBottom: 16 }}>
              ✅ Thank you — your message was sent.
            </p>
            {assemblyId && <ResultPanel assemblyId={assemblyId} />}
            <button
              onClick={() => {
                setAssemblyId(null)
                reRecord()
              }}
              style={ghostBtn}
            >
              Record another
            </button>
          </div>
        )}

        {error && (
          <p style={{ color: "var(--aloud-accent)", marginTop: 16 }}>{error}</p>
        )}

        <p
          style={{
            marginTop: 28,
            fontSize: 12,
            color: "var(--aloud-ink-faint)",
          }}
        >
          event: {slug}
        </p>
      </div>
    </main>
  )
}

// Temporary Stage 1 verification panel: reactively reads the component's stored
// results and plays the normalized mp3. The proper key→URL derivation
// (MEDIA_BASE_URL/key, hard rule 4) lands in the Stage 2 listByEvent query.
// Derive the public R2 key from the stored result's private S3 sslUrl, then
// build the playable URL as MEDIA_BASE_URL/key (hard rule 4 — derive on read).
// Stage 2's listByEvent query does this server-side; this is the Stage 1 stub.
const MEDIA_BASE_URL = process.env.NEXT_PUBLIC_MEDIA_BASE_URL

function keyFromSslUrl(sslUrl: string): string | null {
  try {
    return new URL(sslUrl).pathname.replace(/^\/+/, "")
  } catch {
    return null
  }
}

function ResultPanel({ assemblyId }: { assemblyId: string }) {
  const results = useQuery(api.transloadit.listResults, { assemblyId }) as
    | Array<{ stepName?: string; sslUrl?: string }>
    | undefined

  if (results === undefined) {
    return <p style={{ color: "var(--aloud-ink-soft)" }}>Loading results…</p>
  }

  const normalized =
    results.find((r) => r.stepName === "normalized") ??
    results.find((r) => r.stepName === "stored_normalized")
  const key = normalized?.sslUrl ? keyFromSslUrl(normalized.sslUrl) : null
  const playUrl =
    key && MEDIA_BASE_URL ? `${MEDIA_BASE_URL.replace(/\/$/, "")}/${key}` : null

  if (!playUrl) {
    return (
      <p style={{ color: "var(--aloud-ink-soft)", marginBottom: 16 }}>
        Processing… waiting for the webhook to store the normalized mp3.
      </p>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 13, color: "var(--aloud-ink-faint)" }}>
        Normalized mp3 (from R2):
      </p>
      <audio src={playUrl} controls style={{ width: "100%" }} />
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  appearance: "none",
  border: "none",
  cursor: "pointer",
  width: "100%",
  padding: "16px 20px",
  borderRadius: 999,
  fontSize: 16,
  fontWeight: 600,
  fontFamily: "var(--font-hanken, system-ui)",
  background: "var(--aloud-accent)",
  color: "var(--aloud-accent-ink)",
}

const ghostBtn: React.CSSProperties = {
  appearance: "none",
  cursor: "pointer",
  width: "100%",
  padding: "16px 20px",
  borderRadius: 999,
  fontSize: 16,
  fontWeight: 600,
  fontFamily: "var(--font-hanken, system-ui)",
  background: "transparent",
  color: "var(--aloud-ink)",
  border: "1px solid var(--aloud-line)",
}

const textInput: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--aloud-line)",
  background: "var(--aloud-paper)",
  color: "var(--aloud-ink)",
  fontSize: 15,
}
