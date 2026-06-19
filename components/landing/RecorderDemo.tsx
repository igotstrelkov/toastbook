"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { CreateGuestbookButton } from "@/components/landing/CreateGuestbookButton"
import {
  Btn,
  Eyebrow,
  fmtTime,
  IconMic,
  IconPause,
  IconPlay,
  IconRedo,
  LevelMeter,
  pickMimeType,
  useInterval,
  Waveform,
} from "@/components/recorder/primitives"
import { trackTriedRecording } from "@/lib/analytics"

// Shorter than the guest recorder's 60s — this is just a taster.
const CAP = 30

type DemoState = "idle" | "recording" | "preview" | "error"

// On-page recorder demo. Mirrors the real guest recorder's mic/timer/level UX
// (same primitives) but is entirely local: the clip is played back from an
// in-memory blob URL and never uploaded — no Convex, no Transloadit.
export function RecorderDemo() {
  const [state, setState] = useState<DemoState>("idle")
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const elapsedRef = useRef(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const urlRef = useRef<string | null>(null)
  const trackedRef = useRef(false)

  const setPreview = useCallback((url: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = url
    setPreviewUrl(url)
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Duration comes from this timer, never the blob (webm reports Infinity/NaN).
  useInterval(
    () => {
      const n = +(elapsedRef.current + 0.1).toFixed(1)
      elapsedRef.current = n
      setElapsed(n)
      if (n >= CAP) stopRecording(CAP)
    },
    state === "recording" ? 100 : null
  )

  // Mic permission MUST be requested inside the tap handler (iOS blocks otherwise).
  const startRecording = useCallback(async () => {
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
        setPreview(URL.createObjectURL(blob))
        stopStream()
      }
      mr.start()
      mediaRecorderRef.current = mr
      elapsedRef.current = 0
      setElapsed(0)
      setState("recording")
      if (!trackedRef.current) {
        trackedRef.current = true
        trackTriedRecording()
      }
    } catch {
      stopStream()
      setState("error")
    }
  }, [setPreview, stopStream])

  function stopRecording(forced?: number) {
    setDuration(forced ?? Math.max(1, elapsedRef.current))
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== "inactive") mr.stop()
    setState("preview")
  }

  const reset = useCallback(() => {
    setPreview(null)
    elapsedRef.current = 0
    setElapsed(0)
    setDuration(0)
    setState("idle")
  }, [setPreview])

  // Cleanup on unmount: stop any live tracks and free the blob URL.
  useEffect(() => {
    return () => {
      stopStream()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [stopStream])

  return (
    <div className="demo-card reveal">
      {state === "idle" && <DemoIdle onStart={startRecording} />}
      {state === "recording" && (
        <DemoRecording elapsed={elapsed} onStop={() => stopRecording()} />
      )}
      {state === "preview" && (
        <DemoPreview url={previewUrl} duration={duration} onRedo={reset} />
      )}
      {state === "error" && <DemoError onRetry={startRecording} />}
    </div>
  )
}

/* idle */
function DemoIdle({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div className="demo-mic" aria-hidden="true">
        <IconMic size={34} sw={1.6} />
      </div>
      <h3 className="demo-title">Record a quick test.</h3>
      <p className="demo-sub">
        Tap, talk for a few seconds, and play it back — exactly how your guests
        will. It stays on your device.
      </p>
      <Btn variant="accent" size="lg" block onClick={onStart}>
        <IconMic size={19} /> Record a test message
      </Btn>
      <p className="demo-note">Up to 30 seconds · Nothing is uploaded</p>
    </div>
  )
}

/* recording */
function DemoRecording({
  elapsed,
  onStop,
}: {
  elapsed: number
  onStop: () => void
}) {
  const pct = Math.min(1, elapsed / CAP)
  const near = elapsed >= CAP - 8
  return (
    <div style={{ textAlign: "center" }}>
      <div className="demo-rec-head">
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="rec-dot demo-rec-dot" />
          <Eyebrow style={{ color: "var(--aloud-accent)" }}>Recording</Eyebrow>
        </span>
        <span
          className="mono"
          style={{
            fontFamily: "var(--font-space-mono, monospace)",
            fontSize: 12.5,
            color: near ? "var(--aloud-accent)" : "var(--aloud-ink-faint)",
          }}
        >
          {fmtTime(CAP - elapsed)} left
        </span>
      </div>

      <div
        style={{
          fontFamily: "var(--font-space-mono, monospace)",
          fontSize: 52,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          marginTop: 6,
        }}
      >
        {fmtTime(elapsed)}
      </div>

      <div style={{ display: "flex", justifyContent: "center", margin: "26px 0 4px" }}>
        <LevelMeter active bars={19} color="var(--aloud-accent)" height={64} />
      </div>

      <div
        style={{
          height: 4,
          borderRadius: 99,
          background: "var(--aloud-line)",
          overflow: "hidden",
          margin: "20px 4px 28px",
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

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <button
          onClick={onStop}
          aria-label="Stop recording"
          style={{
            width: 68,
            height: 68,
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
              width: 24,
              height: 24,
              borderRadius: 7,
              background: "var(--aloud-accent)",
            }}
          />
        </button>
        <span style={{ fontSize: 13, color: "var(--aloud-ink-faint)" }}>
          Tap to stop
        </span>
      </div>
    </div>
  )
}

/* preview — local playback + the conversion bridge */
function DemoPreview({
  url,
  duration,
  onRedo,
}: {
  url: string | null
  duration: number
  onRedo: () => void
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
    <div>
      <Eyebrow style={{ textAlign: "center" }}>Your test message</Eyebrow>
      <h3 className="demo-title" style={{ marginTop: 8 }}>
        Have a listen.
      </h3>

      <div className="demo-player">
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
        <button
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            background: "var(--aloud-accent)",
            color: "var(--aloud-accent-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 12px 26px -10px rgba(182,95,63,0.7)",
          }}
        >
          {playing ? (
            <IconPause size={22} />
          ) : (
            <IconPlay size={22} style={{ marginLeft: 3 }} />
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0, color: "var(--aloud-ink-faint)" }}>
          <Waveform
            seed={url ?? "demo"}
            n={40}
            progress={progress}
            played="var(--aloud-accent)"
            height={38}
            barW={3}
            onSeek={(p) => {
              const a = audioRef.current
              if (a && duration) a.currentTime = p * duration
              setT(p * duration)
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
          {fmtTime(playing || t > 0 ? t : duration)}
        </span>
      </div>

      <button onClick={onRedo} className="demo-redo">
        <IconRedo size={15} /> Re-record
      </button>

      <div className="demo-bridge">
        <p className="demo-bridge-line">
          That&apos;s all your guests do. Make your own in two minutes.
        </p>
        <CreateGuestbookButton
          variant="accent"
          className="h-[52px] w-full rounded-full text-base"
        />
        <p className="demo-note" style={{ marginTop: 12 }}>
          Free to set up · No credit card · €49 only when you keep it
        </p>
      </div>
    </div>
  )
}

/* error — mic blocked; still offer the conversion path */
function DemoError({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ textAlign: "center" }}>
      <h3 className="demo-title">We couldn&apos;t reach your mic.</h3>
      <p className="demo-sub">
        Your browser blocked microphone access. Allow it in the address bar and
        try again — or just go ahead and create your guestbook.
      </p>
      <Btn variant="accent" size="lg" block onClick={onRetry}>
        <IconMic size={19} /> Try again
      </Btn>
      <div style={{ marginTop: 10 }}>
        <CreateGuestbookButton
          variant="ghost-brand"
          className="h-12 w-full rounded-full text-sm"
        />
      </div>
    </div>
  )
}
