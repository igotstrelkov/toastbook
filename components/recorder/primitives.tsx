"use client"

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { seededBars } from "@/lib/bars"

// Primitives ported from the Toastbook (Aloud) design system. The design's
// bare CSS vars (--paper, --accent, …) map to our --aloud-* tokens in globals.css.

// iOS Safari yields audio/mp4; Chrome/Firefox yield audio/webm. Pick what the
// device supports; never assume.
export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  for (const c of ["audio/mp4", "audio/webm"]) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return undefined
}

export function extFromMime(mime: string): string {
  if (mime.includes("mp4")) return "m4a"
  if (mime.includes("ogg")) return "ogg"
  return "webm"
}

export function fmtTime(s: number): string {
  s = Math.max(0, Math.floor(s))
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, "0")
  return `${m}:${ss}`
}

// setInterval as a hook; pass delay=null to pause.
export function useInterval(cb: () => void, delay: number | null) {
  const saved = useRef(cb)
  useEffect(() => {
    saved.current = cb
  })
  useEffect(() => {
    if (delay == null) return
    const id = setInterval(() => saved.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}

/* ---------- icons ---------- */
type IconProps = { size?: number; sw?: number; style?: CSSProperties }

function Ic({
  size = 20,
  sw = 1.8,
  style,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {children}
    </svg>
  )
}

export const IconMic = (p: IconProps) => (
  <Ic {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Ic>
)
export const IconPlay = ({ size = 20, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
)
export const IconPause = ({ size = 20, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
    <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" />
    <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" />
  </svg>
)
export const IconCheck = (p: IconProps) => (
  <Ic {...p}>
    <path d="M4 12.5l5 5L20 6.5" />
  </Ic>
)
export const IconRedo = (p: IconProps) => (
  <Ic {...p}>
    <path d="M19 8a8 8 0 1 0 1.5 5M19 3v5h-5" />
  </Ic>
)
export const IconArrow = (p: IconProps) => (
  <Ic {...p}>
    <path d="M5 12h14m0 0l-6-6m6 6l-6 6" />
  </Ic>
)
export const IconImage = (p: IconProps) => (
  <Ic {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M21 17l-5-5-8 7" />
  </Ic>
)
export const IconCopy = (p: IconProps) => (
  <Ic {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M5.5 15.5h-1a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Ic>
)
export const IconDownload = (p: IconProps) => (
  <Ic {...p}>
    <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 20h16" />
  </Ic>
)
export const IconTrash = (p: IconProps) => (
  <Ic {...p}>
    <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M10 11v6M14 11v6" />
  </Ic>
)
export const IconX = (p: IconProps) => (
  <Ic {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Ic>
)
export const IconWave = ({ size = 20, style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    style={style}
  >
    <path d="M5 8v8M8 5v14M11 9v6M14 4v16M17 8v8M20 10v4M23 11v2" opacity="0.9" />
  </svg>
)

/* ---------- button ---------- */
type BtnVariant = "accent" | "ghost" | "quiet" | "primary"

const FONT_UI = "var(--font-hanken, system-ui)"

const btnBase: CSSProperties = {
  fontFamily: FONT_UI,
  fontWeight: 600,
  fontSize: 15,
  letterSpacing: "0.005em",
  border: "none",
  borderRadius: 999,
  padding: "14px 22px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  lineHeight: 1,
  whiteSpace: "nowrap",
  transition: "transform .14s ease, background .18s ease, box-shadow .18s ease",
  WebkitTapHighlightColor: "transparent",
}

const btnVariants: Record<BtnVariant, CSSProperties> = {
  accent: {
    background: "var(--aloud-accent)",
    color: "var(--aloud-accent-ink)",
    boxShadow: "0 10px 22px -10px color-mix(in oklab, var(--aloud-accent), #000 10%)",
  },
  primary: { background: "var(--aloud-ink)", color: "var(--aloud-paper)" },
  ghost: {
    background: "transparent",
    color: "var(--aloud-ink)",
    boxShadow: "inset 0 0 0 1.4px var(--aloud-line)",
  },
  quiet: { background: "transparent", color: "var(--aloud-ink-soft)", padding: "10px 12px" },
}

export function Btn({
  variant = "primary",
  size,
  block,
  children,
  style,
  ...rest
}: {
  variant?: BtnVariant
  size?: "lg"
  block?: boolean
  children: ReactNode
  style?: CSSProperties
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      style={{
        ...btnBase,
        ...btnVariants[variant],
        ...(size === "lg" ? { padding: "17px 26px", fontSize: 16 } : null),
        ...(block ? { width: "100%" } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Eyebrow({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className="eyebrow" style={style}>
      {children}
    </div>
  )
}

/* ---------- live level meter (decorative; animates while active) ---------- */
export function LevelMeter({
  active,
  bars = 17,
  color = "var(--aloud-accent)",
  height = 56,
}: {
  active: boolean
  bars?: number
  color?: string
  height?: number
}) {
  const [levels, setLevels] = useState<number[]>(() => new Array(bars).fill(0.12))
  const raf = useRef(0)
  const phase = useRef(0)
  useEffect(() => {
    if (!active) return // inactive bars are derived at render — no setState here
    let mounted = true
    const tick = () => {
      if (!mounted) return
      phase.current += 0.35
      const next: number[] = []
      for (let i = 0; i < bars; i++) {
        const c = (bars - 1) / 2
        const dist = 1 - Math.abs(i - c) / c
        const wob = 0.5 + 0.5 * Math.sin(phase.current * (0.6 + i * 0.13) + i)
        const rnd = Math.random()
        next.push(
          Math.max(
            0.12,
            Math.min(1, (0.35 + 0.65 * rnd) * (0.45 + 0.7 * dist) * (0.6 + 0.6 * wob)),
          ),
        )
      }
      setLevels(next)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      mounted = false
      cancelAnimationFrame(raf.current)
    }
  }, [active, bars])
  const display = active ? levels : new Array(bars).fill(0.1)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height }}>
      {display.map((l, i) => (
        <i
          key={i}
          style={{
            display: "block",
            width: 4,
            borderRadius: 999,
            background: color,
            opacity: active ? 1 : 0.4,
            height: `${Math.round(l * height)}px`,
            transition: "height .07s linear, opacity .07s linear",
          }}
        />
      ))}
    </div>
  )
}

/* ---------- avatar (initials, hue from name) ---------- */
function hueFromName(name: string): number {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 360
}

export function Avatar({ name = "", size = 42 }: { name?: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "♥"
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-newsreader, Georgia, serif)",
        fontSize: size * 0.42,
        fontWeight: 500,
        color: "var(--aloud-ink)",
        background: `oklch(0.9 0.045 ${hueFromName(name)})`,
        boxShadow: "inset 0 0 0 1.2px rgba(0,0,0,0.06)",
      }}
    >
      {initials}
    </div>
  )
}

/* ---------- static waveform with progress + seek ---------- */
export function Waveform({
  seed = "a",
  n = 48,
  progress = 0,
  onSeek,
  height = 40,
  barW = 3,
  gap = 2,
  played,
  style,
}: {
  seed?: string
  n?: number
  progress?: number
  onSeek?: (p: number) => void
  height?: number
  barW?: number
  gap?: number
  played?: string
  style?: CSSProperties
}) {
  const bars = useMemo(() => seededBars(seed, n), [seed, n])
  const ref = useRef<HTMLDivElement>(null)
  const handle = (e: React.MouseEvent) => {
    if (!onSeek || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
  }
  return (
    <div
      ref={ref}
      onClick={handle}
      style={{
        display: "flex",
        alignItems: "center",
        gap,
        height,
        cursor: onSeek ? "pointer" : "default",
        ...style,
      }}
    >
      {bars.map((b, i) => {
        const on = i / n <= progress
        return (
          <span
            key={i}
            style={{
              width: barW,
              height: `${Math.max(2, b * height)}px`,
              borderRadius: 99,
              background: on ? played || "currentColor" : "currentColor",
              opacity: on ? 1 : 0.22,
              flexShrink: 0,
              transition: "opacity .1s",
            }}
          />
        )
      })}
    </div>
  )
}
