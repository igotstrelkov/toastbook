"use client"

import { seededBars } from "@/lib/bars"
import { useCallback, useEffect, useRef, useState } from "react"

interface Sample {
  name: string
  rel: string
  src: string
  dur: number // fallback shown until the file's real duration loads
  hue: number
  seed: string
}

const SAMPLES: Sample[] = [
  {
    name: "Victor",
    rel: "The old family friend",
    src: "/voices/1.wav",
    dur: 26,
    hue: 32,
    seed: "rec-victor",
  },
  {
    name: "Sarah",
    rel: "Maid of honor",
    src: "/voices/2.wav",
    dur: 22,
    hue: 65,
    seed: "rec-sarah",
  },
  {
    name: "Stephen",
    rel: "The best man",
    src: "/voices/3.wav",
    dur: 18,
    hue: 150,
    seed: "rec-stephen",
  },
  {
    name: "Nancy",
    rel: "The little niece",
    src: "/voices/4.wav",
    dur: 14,
    hue: 280,
    seed: "rec-nancy",
  },
]

// Deterministic from static SAMPLES — computed once at module load.
const BARS = SAMPLES.map((s) => seededBars(s.seed, 54))

function fmt(s: number): string {
  s = Math.max(0, Math.floor(s))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
}

const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
)
const IconPause = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" />
    <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" />
  </svg>
)

interface CardState {
  playing: boolean
  elapsed: number
  progress: number
  dur: number
}

export function VoiceSection() {
  const [states, setStates] = useState<CardState[]>(
    SAMPLES.map((s) => ({
      playing: false,
      elapsed: 0,
      progress: 0,
      dur: s.dur,
    }))
  )
  const audioRefs = useRef<(HTMLAudioElement | null)[]>(SAMPLES.map(() => null))
  const rafRef = useRef<number | null>(null)
  const currentRef = useRef<number | null>(null)
  const tickRef = useRef<() => void>(() => {})

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  // Drive progress from the real audio element's clock for smooth updates
  // (the native `timeupdate` event only fires ~4x/sec, which looks choppy).
  const tick = useCallback(() => {
    const idx = currentRef.current
    if (idx === null) return
    const a = audioRefs.current[idx]
    if (!a) return
    const dur = a.duration || SAMPLES[idx].dur
    const elapsed = a.currentTime
    setStates((s) =>
      s.map((c, i) =>
        i === idx ? { ...c, elapsed, progress: dur ? elapsed / dur : 0 } : c
      )
    )
    rafRef.current = requestAnimationFrame(() => tickRef.current())
  }, [])

  // Route the recursive RAF call through a ref so `tick` doesn't reference itself.
  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  const play = useCallback(
    (idx: number) => {
      // Only one plays at a time — pause any other and reset its UI state.
      const prev = currentRef.current
      if (prev !== null && prev !== idx) {
        audioRefs.current[prev]?.pause()
      }
      cancelRaf()
      const a = audioRefs.current[idx]
      if (!a) return
      if (a.ended) a.currentTime = 0
      currentRef.current = idx
      void a.play().catch(() => {})
      setStates((s) => s.map((c, i) => ({ ...c, playing: i === idx })))
      rafRef.current = requestAnimationFrame(() => tickRef.current())
    },
    [cancelRaf]
  )

  const pause = useCallback(
    (idx: number) => {
      audioRefs.current[idx]?.pause()
      cancelRaf()
      currentRef.current = null
      setStates((s) =>
        s.map((c, i) => (i === idx ? { ...c, playing: false } : c))
      )
    },
    [cancelRaf]
  )

  const seek = useCallback((idx: number, p: number) => {
    const a = audioRefs.current[idx]
    if (!a) return
    const dur = a.duration || SAMPLES[idx].dur
    a.currentTime = p * dur
    setStates((s) =>
      s.map((c, i) => (i === idx ? { ...c, elapsed: p * dur, progress: p } : c))
    )
  }, [])

  const onLoadedMetadata = useCallback((idx: number) => {
    const a = audioRefs.current[idx]
    if (!a || !isFinite(a.duration)) return
    setStates((s) =>
      s.map((c, i) => (i === idx ? { ...c, dur: a.duration } : c))
    )
  }, [])

  const onEnded = useCallback(
    (idx: number) => {
      cancelRaf()
      currentRef.current = null
      const a = audioRefs.current[idx]
      if (a) a.currentTime = 0
      setStates((s) =>
        s.map((c, i) =>
          i === idx ? { ...c, playing: false, elapsed: 0, progress: 0 } : c
        )
      )
    },
    [cancelRaf]
  )

  useEffect(() => () => cancelRaf(), [cancelRaf])

  return (
    <section className="section alt" id="voices">
      <div className="wrap">
        <div className="section-head center reveal">
          <div className="eyebrow">Listen</div>
          <h2 className="section-title">
            A guestbook sounds
            <br />
            <em>like this.</em>
          </h2>
          <p className="section-sub">
            Tap play. This is the kind of thing you&apos;ll hear when the music
            stops and the day is done.
          </p>
        </div>
        <div className="voices">
          {SAMPLES.map((s, idx) => {
            const bars = BARS[idx]
            const state = states[idx]
            const nOn = Math.round(state.progress * bars.length)
            return (
              <div key={idx} className="voice-card">
                <audio
                  ref={(el) => {
                    audioRefs.current[idx] = el
                  }}
                  src={s.src}
                  preload="metadata"
                  onLoadedMetadata={() => onLoadedMetadata(idx)}
                  onEnded={() => onEnded(idx)}
                />
                <div className="voice-header">
                  <div
                    className="voice-av"
                    style={{ background: `oklch(0.9 0.05 ${s.hue})` }}
                  >
                    {initials(s.name)}
                  </div>
                  <div className="voice-meta">
                    <span className="voice-name">{s.name}</span>
                    <span className="voice-rel">{s.rel}</span>
                  </div>
                </div>
                <div className="voice-row">
                  <button
                    className={`play-btn${state.playing ? "playing" : ""}`}
                    aria-label={`${state.playing ? "Pause" : "Play"} message from ${s.name}`}
                    onClick={() => (state.playing ? pause(idx) : play(idx))}
                  >
                    {state.playing ? <IconPause /> : <IconPlay />}
                  </button>
                  <div
                    className="wave"
                    role="slider"
                    aria-label="Seek"
                    aria-valuenow={Math.round(state.progress * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      seek(
                        idx,
                        Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
                      )
                    }}
                  >
                    {bars.map((h, bi) => (
                      <span
                        key={bi}
                        className={bi < nOn ? "on" : undefined}
                        style={{
                          height: Math.max(2, Math.round(h * 38)) + "px",
                        }}
                      />
                    ))}
                  </div>
                  <span className="voice-dur">
                    {state.playing || state.progress > 0
                      ? fmt(state.elapsed)
                      : fmt(state.dur)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
