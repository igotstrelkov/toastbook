"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { seededBars } from "@/lib/bars"

interface Sample {
  name: string
  rel: string
  dur: number
  hue: number
  seed: string
}

const SAMPLES: Sample[] = [
  { name: "Aunt Rosa",       rel: "Mother of the bride", dur: 26, hue: 32,  seed: "rec-rosa"   },
  { name: "Grandpa Lou",     rel: "A toast, of course",  dur: 22, hue: 65,  seed: "rec-lou"    },
  { name: "The Bridesmaids", rel: "All five of them",    dur: 18, hue: 150, seed: "rec-brides" },
  { name: "Marcus Bell",     rel: "College roommate",    dur: 14, hue: 280, seed: "rec-marcus" },
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
}

export function VoiceSection() {
  const [states, setStates] = useState<CardState[]>(
    SAMPLES.map(() => ({ playing: false, elapsed: 0, progress: 0 })),
  )
  const simStartRef = useRef<(number | null)[]>(SAMPLES.map(() => null))
  const simAtRef = useRef<number[]>(SAMPLES.map(() => 0))
  const rafRef = useRef<number | null>(null)
  const currentRef = useRef<number | null>(null)
  const tickRef = useRef<(idx: number) => void>(() => {})

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const stopCurrent = useCallback(
    (reset = false) => {
      cancelRaf()
      const prev = currentRef.current
      if (prev !== null) {
        setStates((s) =>
          s.map((c, i) =>
            i === prev
              ? { ...c, playing: false, elapsed: reset ? 0 : c.elapsed, progress: reset ? 0 : c.progress }
              : c,
          ),
        )
        if (reset) simAtRef.current[prev] = 0
      }
      currentRef.current = null
    },
    [cancelRaf],
  )

  const tick = useCallback(
    (idx: number) => {
      const start = simStartRef.current[idx]
      if (start === null) return
      const elapsed = (performance.now() - start) / 1000
      const dur = SAMPLES[idx].dur
      if (elapsed >= dur) {
        setStates((s) =>
          s.map((c, i) => (i === idx ? { playing: false, elapsed: dur, progress: 1 } : c)),
        )
        simAtRef.current[idx] = 0
        currentRef.current = null
        rafRef.current = null
        return
      }
      setStates((s) =>
        s.map((c, i) => (i === idx ? { ...c, elapsed, progress: elapsed / dur } : c)),
      )
      rafRef.current = requestAnimationFrame(() => tickRef.current(idx))
    },
    [],
  )

  // Route the recursive RAF call through a ref so `tick` doesn't reference itself.
  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  const play = useCallback(
    (idx: number) => {
      stopCurrent(true)
      currentRef.current = idx
      simStartRef.current[idx] = performance.now() - simAtRef.current[idx] * 1000
      setStates((s) => s.map((c, i) => (i === idx ? { ...c, playing: true } : c)))
      rafRef.current = requestAnimationFrame(() => tick(idx))
    },
    [stopCurrent, tick],
  )

  const pause = useCallback(
    (idx: number, currentElapsed: number) => {
      cancelRaf()
      simAtRef.current[idx] = currentElapsed
      currentRef.current = null
      setStates((s) => s.map((c, i) => (i === idx ? { ...c, playing: false } : c)))
    },
    [cancelRaf],
  )

  const seek = useCallback(
    (idx: number, p: number, isPlaying: boolean) => {
      const dur = SAMPLES[idx].dur
      const newElapsed = p * dur
      simAtRef.current[idx] = newElapsed
      setStates((s) =>
        s.map((c, i) => (i === idx ? { ...c, elapsed: newElapsed, progress: p } : c)),
      )
      if (isPlaying) {
        simStartRef.current[idx] = performance.now() - newElapsed * 1000
      }
    },
    [],
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
            Tap play. This is the kind of thing you&apos;ll hear when the music stops and the day is done.
          </p>
        </div>
        <div className="voices">
          {SAMPLES.map((s, idx) => {
            const bars = BARS[idx]
            const state = states[idx]
            const nOn = Math.round(state.progress * bars.length)
            return (
              <div key={idx} className="voice-card">
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
                    className={`play-btn${state.playing ? " playing" : ""}`}
                    aria-label={`${state.playing ? "Pause" : "Play"} message from ${s.name}`}
                    onClick={() =>
                      state.playing ? pause(idx, state.elapsed) : play(idx)
                    }
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
                        Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                        state.playing,
                      )
                    }}
                  >
                    {bars.map((h, bi) => (
                      <span
                        key={bi}
                        className={bi < nOn ? "on" : undefined}
                        style={{ height: Math.max(2, Math.round(h * 38)) + "px" }}
                      />
                    ))}
                  </div>
                  <span className="voice-dur">
                    {state.playing || state.progress > 0
                      ? fmt(state.elapsed)
                      : fmt(s.dur)}
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
