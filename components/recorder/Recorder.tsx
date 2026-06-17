"use client"

import Uppy from "@uppy/core"
import Transloadit, { type AssemblyOptions } from "@uppy/transloadit"
import { useAction, useMutation, useQuery } from "convex/react"
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { api } from "@/convex/_generated/api"

import {
  Btn,
  Eyebrow,
  fmtTime,
  IconArrow,
  IconCheck,
  IconMic,
  IconPause,
  IconPlay,
  IconRedo,
  IconWave,
  LevelMeter,
  useInterval,
  Waveform,
} from "./primitives"

const CAP = 60 // seconds

type RecorderEvent = {
  coupleNames: string
  date: string
  coverUrl: string | null
  greetingUrl: string | null
  greetDur: number
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase()
}

// Render "Maya & Theo" with the ampersand in the clay accent serif.
function Names({ value }: { value: string }) {
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

type Screen =
  | "cover"
  | "permission"
  | "recording"
  | "preview"
  | "name"
  | "uploading"
  | "done"

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

export function Recorder({ slug }: { slug: string }) {
  const eventData = useQuery(api.events.getEventBySlug, { slug })
  const getAssemblyOptions = useAction(api.guest.getGuestAssemblyOptions)
  const registerRecording = useMutation(api.recordings.registerRecording)

  const [screen, setScreen] = useState<Screen>("cover")
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [guestName, setGuestName] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [uploadStatus, setUploadStatus] = useState("Preparing…")

  const elapsedRef = useRef(0)
  const recordedBlobRef = useRef<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Recording timer — the duration source of truth (hard rule 9: never the blob).
  useInterval(
    () => {
      const n = +(elapsedRef.current + 0.1).toFixed(1)
      elapsedRef.current = n
      setElapsed(n)
      if (n >= CAP) stopRecording(CAP)
    },
    screen === "recording" ? 100 : null,
  )

  // Mic permission MUST be requested inside the tap handler (iOS blocks otherwise).
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
        stopStream()
      }
      mr.start()
      mediaRecorderRef.current = mr
      elapsedRef.current = 0
      setElapsed(0)
      setScreen("recording")
    } catch {
      setError(
        "We couldn't access your microphone. Please allow access in your browser and try again.",
      )
    }
  }, [stopStream])

  function stopRecording(forced?: number) {
    setDuration(forced ?? Math.max(1, elapsedRef.current))
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== "inactive") mr.stop()
    setScreen("preview")
  }

  const reset = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    recordedBlobRef.current = null
    elapsedRef.current = 0
    setElapsed(0)
    setDuration(0)
    setGuestName("")
    setError(null)
    setUploadPct(0)
    setScreen("cover")
  }, [])

  // Real upload to Transloadit when entering the uploading screen.
  useEffect(() => {
    if (screen !== "uploading") return
    const blob = recordedBlobRef.current
    if (!blob) {
      setScreen("preview")
      return
    }
    let cancelled = false
    setUploadPct(0)
    setUploadStatus("Creating your message…")
    const uppy = new Uppy({ autoProceed: false }).use(Transloadit, {
      // Don't block the guest on server-side encoding — the webhook finalizes
      // the recording (hard rule 8). The upload resolving is enough.
      waitForEncoding: false,
      assemblyOptions: async () => {
        const { assemblyOptions } = await getAssemblyOptions({
          slug,
          guestName: guestName.trim() || undefined,
        })
        return assemblyOptions as unknown as AssemblyOptions
      },
    })
    uppy.on("progress", (n) => {
      if (cancelled) return
      setUploadPct(n)
      setUploadStatus(n < 100 ? "Uploading…" : "Confirming…")
    })
    // Optimistic insert so the host sees a "processing" row instantly. NOT
    // authoritative (hard rule 8) — the webhook/reconciler creates it anyway.
    uppy.on("transloadit:assembly-created", (assembly) => {
      const assemblyId = (assembly as { assembly_id?: string }).assembly_id
      if (!assemblyId) return
      void registerRecording({
        slug,
        assemblyId,
        guestName: guestName.trim() || undefined,
        durationSeconds: Math.round(duration),
      }).catch(() => {})
    })
    ;(async () => {
      try {
        const ext = extFromMime(blob.type)
        uppy.addFile({ name: `message.${ext}`, type: blob.type, data: blob })
        await uppy.upload()
        if (cancelled) return
        setUploadPct(100)
        setUploadStatus("Saved")
        setTimeout(() => {
          if (!cancelled) setScreen("done")
        }, 550)
      } catch {
        if (cancelled) return
        setError("Upload failed — please check your connection and try again.")
        setScreen("preview")
      } finally {
        uppy.destroy()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  useEffect(() => {
    return () => {
      stopStream()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const event: RecorderEvent | null = eventData
    ? {
        coupleNames: eventData.coupleNames ?? eventData.title,
        date: formatDate(eventData.eventDate),
        coverUrl: eventData.coverUrl,
        greetingUrl: eventData.greetingUrl,
        greetDur: 12,
      }
    : null

  return (
    <div
      className="aloud"
      data-event-slug={slug}
      style={{
        minHeight: "100dvh",
        background: "var(--aloud-paper)",
        color: "var(--aloud-ink)",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          margin: "0 auto",
          minHeight: "100dvh",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {eventData === undefined && <GLoading />}
        {eventData === null && <GUnavailable />}
        {event && screen === "cover" && (
          <GCover event={event} onRecord={() => setScreen("permission")} />
        )}
        {event && screen === "permission" && (
          <GPermission
            error={error}
            onAllow={startRecording}
            onBack={() => setScreen("cover")}
          />
        )}
        {event && screen === "recording" && (
          <GRecording
            elapsed={elapsed}
            onStop={() => stopRecording()}
            onCancel={() => {
              stopStream()
              reset()
            }}
          />
        )}
        {event && screen === "preview" && (
          <GPreview
            url={previewUrl}
            duration={duration}
            error={error}
            onRedo={startRecording}
            onKeep={() => setScreen("name")}
          />
        )}
        {event && screen === "name" && (
          <GName
            event={event}
            value={guestName}
            setValue={setGuestName}
            onSubmit={() => setScreen("uploading")}
          />
        )}
        {event && screen === "uploading" && (
          <GUploading pct={uploadPct} status={uploadStatus} />
        )}
        {event && screen === "done" && <GDone event={event} onAgain={reset} />}
      </div>
    </div>
  )
}

type Event = RecorderEvent

/* loading + unavailable states */
function GLoading() {
  return (
    <GScreen center>
      <div style={{ textAlign: "center", color: "var(--aloud-ink-faint)" }}>
        <IconWave size={22} style={{ color: "var(--aloud-accent)" }} />
        <p style={{ marginTop: 12, fontSize: 14 }}>Loading…</p>
      </div>
    </GScreen>
  )
}

function GUnavailable() {
  return (
    <GScreen center>
      <div style={{ textAlign: "center" }}>
        <Eyebrow>Not available</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontWeight: 400,
            fontSize: 30,
            margin: "12px 0 12px",
          }}
        >
          This guestbook
          <br />
          isn&apos;t available.
        </h2>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: "var(--aloud-ink-soft)",
            maxWidth: 290,
            margin: "0 auto",
          }}
        >
          The link may be incorrect, or the couple hasn&apos;t opened their
          guestbook yet. Double-check the link or QR code.
        </p>
      </div>
    </GScreen>
  )
}

/* shared screen shell */
function GScreen({
  children,
  center,
  style,
}: {
  children: ReactNode
  center?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      className="rec-fade-up"
      style={{
        minHeight: "100dvh",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: center ? "center" : "flex-start",
        padding: "48px 22px 34px",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* 1. Cover */
function GCover({ event, onRecord }: { event: Event; onRecord: () => void }) {
  const [greet, setGreet] = useState(false)
  const [gt, setGt] = useState(0)
  useInterval(
    () =>
      setGt((p) => {
        const n = p + 0.1
        if (n >= event.greetDur) {
          setGreet(false)
          return 0
        }
        return n
      }),
    greet ? 100 : null,
  )
  return (
    <GScreen>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <IconWave size={15} style={{ color: "var(--aloud-accent)" }} />
        <Eyebrow>A Voice Guestbook</Eyebrow>
      </div>

      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 28,
          height: 250,
          marginBottom: 22,
          boxShadow: "var(--shadow-card)",
          background:
            "repeating-linear-gradient(135deg, color-mix(in oklab, var(--aloud-paper-3), #000 2%) 0 11px, var(--aloud-paper-2) 11px 22px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <span
            className="mono"
            style={{
              fontFamily: "var(--font-space-mono, monospace)",
              fontSize: 10.5,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--aloud-ink-faint)",
              background:
                "color-mix(in oklab, var(--aloud-paper), transparent 14%)",
              padding: "5px 9px",
              borderRadius: 6,
            }}
          >
            cover photo
          </span>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(35,24,16,0.34), transparent 52%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 18,
            color: "#fff",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-newsreader, Georgia, serif)",
              fontStyle: "italic",
              fontSize: 13,
              opacity: 0.92,
            }}
          >
            are getting married
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <Eyebrow style={{ marginBottom: 10 }}>Leave a message for</Eyebrow>
        <h1
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontWeight: 400,
            lineHeight: 1.02,
            letterSpacing: "-0.018em",
            fontSize: 46,
            margin: "0 0 10px",
          }}
        >
          <Names value={event.coupleNames} />
        </h1>
        <div
          style={{
            fontFamily: "var(--font-space-mono, monospace)",
            fontSize: 12,
            color: "var(--aloud-ink-faint)",
            letterSpacing: "0.04em",
          }}
        >
          {event.date}
        </div>
      </div>

      <button
        onClick={() => setGreet((g) => !g)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "11px 13px",
          margin: "22px 0 0",
          background: "var(--aloud-paper-2)",
          border: "1.4px solid var(--aloud-line)",
          borderRadius: 18,
          cursor: "pointer",
          textAlign: "left",
          width: "100%",
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--aloud-ink)",
            color: "var(--aloud-paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {greet ? <IconPause size={15} /> : <IconPlay size={15} style={{ marginLeft: 2 }} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>
            A hello from the couple
          </span>
          <div style={{ color: "var(--aloud-ink-faint)", marginTop: 4 }}>
            <Waveform
              seed="greeting"
              n={32}
              progress={greet ? gt / event.greetDur : 0}
              played="var(--aloud-accent)"
              height={16}
              barW={2.5}
            />
          </div>
        </span>
        <span
          style={{
            fontFamily: "var(--font-space-mono, monospace)",
            fontSize: 12,
            color: "var(--aloud-ink-soft)",
          }}
        >
          0:{String(event.greetDur).padStart(2, "0")}
        </span>
      </button>

      <div style={{ flex: 1, minHeight: 18 }} />

      <Btn variant="accent" size="lg" block onClick={onRecord}>
        <IconMic size={19} /> Record your message
      </Btn>
      <Eyebrow
        style={{
          textAlign: "center",
          marginTop: 14,
          fontSize: 10,
          color: "var(--aloud-ink-faint)",
        }}
      >
        No app · No account · Up to 60 seconds
      </Eyebrow>
    </GScreen>
  )
}

/* 2. Permission priming */
function GPermission({
  error,
  onAllow,
  onBack,
}: {
  error: string | null
  onAllow: () => void
  onBack: () => void
}) {
  return (
    <GScreen center>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: "50%",
            margin: "0 auto 26px",
            background: "var(--aloud-accent-tint)",
            color: "var(--aloud-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconMic size={38} sw={1.6} />
        </div>
        <Eyebrow>One quick thing</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontWeight: 400,
            lineHeight: 1.05,
            fontSize: 31,
            margin: "12px 0 12px",
          }}
        >
          We&apos;ll need your
          <br />
          microphone.
        </h2>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: "var(--aloud-ink-soft)",
            maxWidth: 290,
            margin: "0 auto 30px",
          }}
        >
          Tap allow, then speak when you&apos;re ready. Nothing is sent until you
          press{" "}
          <em style={{ fontFamily: "var(--font-newsreader, Georgia, serif)" }}>
            Keep
          </em>{" "}
          — re-record as many times as you like.
        </p>
        {error && (
          <p style={{ color: "var(--aloud-accent)", marginBottom: 16, fontSize: 14 }}>
            {error}
          </p>
        )}
        <Btn variant="accent" size="lg" block onClick={onAllow}>
          Allow microphone
        </Btn>
        <Btn variant="quiet" block onClick={onBack} style={{ marginTop: 8 }}>
          Not now
        </Btn>
      </div>
    </GScreen>
  )
}

/* 3. Recording */
function GRecording({
  elapsed,
  onStop,
  onCancel,
}: {
  elapsed: number
  onStop: () => void
  onCancel: () => void
}) {
  const pct = Math.min(1, elapsed / CAP)
  const near = elapsed >= CAP - 10
  return (
    <GScreen center>
      <div
        style={{
          position: "absolute",
          top: 52,
          left: 22,
          right: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="rec-dot"
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "var(--aloud-accent)",
            }}
          />
          <Eyebrow style={{ color: "var(--aloud-accent)" }}>Recording</Eyebrow>
        </div>
        <span
          style={{
            fontFamily: "var(--font-space-mono, monospace)",
            fontSize: 12.5,
            color: near ? "var(--aloud-accent)" : "var(--aloud-ink-faint)",
          }}
        >
          {fmtTime(CAP - elapsed)} left
        </span>
      </div>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-space-mono, monospace)",
            fontSize: 64,
            fontWeight: 700,
            color: "var(--aloud-ink)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          {fmtTime(elapsed)}
        </div>
        <div
          style={{
            fontFamily: "var(--font-space-mono, monospace)",
            fontSize: 13,
            color: "var(--aloud-ink-faint)",
            marginTop: 6,
          }}
        >
          / {fmtTime(CAP)}
        </div>

        <div style={{ display: "flex", justifyContent: "center", margin: "38px 0 8px" }}>
          <LevelMeter active bars={21} color="var(--aloud-accent)" height={86} />
        </div>

        <div
          style={{
            height: 4,
            borderRadius: 99,
            background: "var(--aloud-line)",
            overflow: "hidden",
            margin: "26px 8px 0",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct * 100}%`,
              background: "var(--aloud-accent)",
              transition: "width .1s linear",
            }}
          />
        </div>
        <p
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontStyle: "italic",
            fontSize: 16,
            color: "var(--aloud-ink-soft)",
            marginTop: 26,
          }}
        >
          Speak from the heart — they&apos;ll hear it forever.
        </p>
      </div>

      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <button
          onClick={onStop}
          aria-label="Stop recording"
          style={{
            width: 78,
            height: 78,
            borderRadius: "50%",
            border: "3px solid var(--aloud-accent)",
            background: "var(--aloud-paper)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 26px -10px rgba(182,95,63,0.6)",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "var(--aloud-accent)",
            }}
          />
        </button>
        <Btn variant="quiet" onClick={onCancel} style={{ fontSize: 13 }}>
          Tap to stop · start over
        </Btn>
      </div>
    </GScreen>
  )
}

/* 4. Preview — real audio playback synced to the waveform */
function GPreview({
  url,
  duration,
  error,
  onRedo,
  onKeep,
}: {
  url: string | null
  duration: number
  error: string | null
  onRedo: () => void
  onKeep: () => void
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const progress = duration ? t / duration : 0

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) a.pause()
    else void a.play().catch(() => {})
  }

  return (
    <GScreen>
      <Eyebrow style={{ textAlign: "center" }}>Your message</Eyebrow>
      <h2
        style={{
          fontFamily: "var(--font-newsreader, Georgia, serif)",
          fontWeight: 400,
          fontSize: 34,
          textAlign: "center",
          margin: "12px 0 28px",
        }}
      >
        Have a listen.
      </h2>

      <div
        style={{
          background: "var(--aloud-paper-2)",
          border: "1.4px solid var(--aloud-line)",
          borderRadius: 18,
          padding: "26px 22px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {url && (
          <audio
            ref={audioRef}
            src={url}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
            onEnded={() => {
              setPlaying(false)
              setT(0)
            }}
          />
        )}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <button
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              background: "var(--aloud-accent)",
              color: "var(--aloud-accent-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 26px -10px rgba(182,95,63,0.7)",
            }}
          >
            {playing ? <IconPause size={26} /> : <IconPlay size={26} style={{ marginLeft: 3 }} />}
          </button>
        </div>
        <div style={{ color: "var(--aloud-ink-faint)" }}>
          <Waveform
            seed={url ?? "preview"}
            n={46}
            progress={progress}
            played="var(--aloud-accent)"
            height={46}
            barW={3}
            onSeek={(p) => {
              const a = audioRef.current
              if (a && duration) a.currentTime = p * duration
              setT(p * duration)
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <span
            style={{
              fontFamily: "var(--font-space-mono, monospace)",
              fontSize: 12.5,
              color: "var(--aloud-ink-soft)",
            }}
          >
            {fmtTime(t)}
          </span>
          <span
            style={{
              fontFamily: "var(--font-space-mono, monospace)",
              fontSize: 12.5,
              color: "var(--aloud-ink-soft)",
            }}
          >
            {fmtTime(duration)}
          </span>
        </div>
      </div>

      {error && (
        <p style={{ color: "var(--aloud-accent)", marginTop: 16, textAlign: "center" }}>
          {error}
        </p>
      )}

      <div style={{ flex: 1, minHeight: 20 }} />
      <Btn variant="accent" size="lg" block onClick={onKeep}>
        <IconCheck size={18} /> Keep it
      </Btn>
      <Btn variant="ghost" block onClick={onRedo} style={{ marginTop: 10 }}>
        <IconRedo size={17} /> Re-record
      </Btn>
    </GScreen>
  )
}

/* 5. Name */
function GName({
  event,
  value,
  setValue,
  onSubmit,
}: {
  event: Event
  value: string
  setValue: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <GScreen>
      <div style={{ flex: 1 }} />
      <Eyebrow>Almost there</Eyebrow>
      <h2
        style={{
          fontFamily: "var(--font-newsreader, Georgia, serif)",
          fontWeight: 400,
          fontSize: 36,
          margin: "12px 0 22px",
        }}
      >
        Who&apos;s it from?
      </h2>
      <input
        autoFocus
        value={value}
        maxLength={40}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        placeholder="e.g. Aunt Rosa"
        style={{
          fontFamily: "var(--font-newsreader, Georgia, serif)",
          fontSize: 21,
          color: "var(--aloud-ink)",
          background: "var(--aloud-paper)",
          border: "1.4px solid var(--aloud-line)",
          borderRadius: 11,
          padding: "13px 15px",
          width: "100%",
          outline: "none",
        }}
      />
      <p
        style={{
          fontSize: 13.5,
          color: "var(--aloud-ink-faint)",
          marginTop: 12,
          lineHeight: 1.5,
        }}
      >
        So {event.coupleNames} knows who to thank. You can leave this blank.
      </p>
      <div style={{ flex: 1 }} />
      <Btn variant="accent" size="lg" block onClick={onSubmit}>
        Send to {event.coupleNames} <IconArrow size={18} />
      </Btn>
      <Btn variant="quiet" block onClick={onSubmit} style={{ marginTop: 6 }}>
        Skip — send anonymously
      </Btn>
    </GScreen>
  )
}

/* 6. Uploading */
function GUploading({ pct, status }: { pct: number; status: string }) {
  const R = 42
  const C = 2 * Math.PI * R
  return (
    <GScreen center>
      <div style={{ textAlign: "center" }}>
        <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto 30px" }}>
          <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="48" cy="48" r={R} fill="none" stroke="var(--aloud-line)" strokeWidth="5" />
            <circle
              cx="48"
              cy="48"
              r={R}
              fill="none"
              stroke="var(--aloud-accent)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct / 100)}
              style={{ transition: "stroke-dashoffset .2s" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-space-mono, monospace)",
                fontSize: 19,
                fontWeight: 700,
              }}
            >
              {Math.round(pct)}%
            </span>
          </div>
        </div>
        <Eyebrow>Saving</Eyebrow>
        <p
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontSize: 23,
            margin: "10px 0 0",
            minHeight: 30,
          }}
        >
          {status}
        </p>
        <p style={{ fontSize: 13.5, color: "var(--aloud-ink-faint)", marginTop: 14 }}>
          Keep this page open for a moment.
        </p>
      </div>
    </GScreen>
  )
}

/* 7. Thank you */
function GDone({ event, onAgain }: { event: Event; onAgain: () => void }) {
  return (
    <GScreen center>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            margin: "0 auto 26px",
            background: "var(--aloud-accent)",
            color: "var(--aloud-accent-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconCheck size={34} />
        </div>
        <Eyebrow>Message sent</Eyebrow>
        <h1
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontWeight: 400,
            fontSize: 52,
            margin: "14px 0 16px",
          }}
        >
          Thank you.
        </h1>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--aloud-ink-soft)",
            maxWidth: 300,
            margin: "0 auto",
          }}
        >
          Your voice is now part of{" "}
          <span
            style={{
              fontFamily: "var(--font-newsreader, Georgia, serif)",
              fontStyle: "italic",
              color: "var(--aloud-ink)",
            }}
          >
            {event.coupleNames}&apos;s
          </span>{" "}
          guestbook — one of the moments they&apos;ll keep forever.
        </p>
        <div style={{ margin: "30px auto 0", maxWidth: 280 }}>
          <Btn variant="ghost" block onClick={onAgain}>
            <IconMic size={17} /> Record another
          </Btn>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            marginTop: 30,
            color: "var(--aloud-ink-faint)",
          }}
        >
          <IconWave size={13} />
          <Eyebrow style={{ fontSize: 10 }}>Made with Toastbook</Eyebrow>
        </div>
      </div>
    </GScreen>
  )
}
