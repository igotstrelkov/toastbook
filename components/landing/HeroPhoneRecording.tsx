"use client"

import { useEffect, useState } from "react"

import { fmtTime, LevelMeter, useInterval } from "@/components/recorder/primitives"

// Animated "recording in progress" frame for the hero phone mock — the most
// product-defining moment (timer + live level meter). Decorative only; the
// parent hero-visual is aria-hidden. Honours prefers-reduced-motion.
export function HeroPhoneRecording() {
  const [t, setT] = useState(8) // start mid-count so it reads as live on load
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduce(mq.matches)
    sync()
    mq.addEventListener?.("change", sync)
    return () => mq.removeEventListener?.("change", sync)
  }, [])

  // Gentle loop: count up, then restart so it always looks mid-recording.
  useInterval(() => setT((s) => (s >= 34 ? 6 : s + 1)), reduce ? null : 1000)

  return (
    <div className="phone-recording">
      <div className="phone-rec-top">
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span className="rec-dot phone-rec-dot" />
          <span className="phone-rec-label">Recording</span>
        </span>
        <span className="phone-rec-time">{fmtTime(t)}</span>
      </div>
      <LevelMeter active={!reduce} bars={17} height={34} color="var(--aloud-accent)" />
    </div>
  )
}
