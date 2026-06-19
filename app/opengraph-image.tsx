import { ImageResponse } from "next/og"

// Dynamic social-share card (auto-wired into og:image + twitter:image by Next's
// file convention). Brand palette hardcoded as hex — Satori doesn't resolve our
// oklch CSS vars.
export const alt = "Toastbook — A voice guestbook for weddings"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const PAPER = "#FBF6EF"
const INK = "#231A14"
const INK_SOFT = "#6B6258"
const ACCENT = "#B65F3F"
const LINE = "#DAD3C8"

export default function OpengraphImage() {
  const bars = [22, 40, 70, 120, 86, 150, 60, 180, 96, 210, 130, 70, 160, 50, 110, 78, 44, 28]
  const wave = [...bars, ...bars.slice().reverse()]
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 34 }}>
            {[14, 26, 18, 34, 22].map((h, i) => (
              <div key={i} style={{ width: 6, height: h, borderRadius: 99, background: ACCENT }} />
            ))}
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: INK }}>Toastbook</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 78, lineHeight: 1.04, color: INK, letterSpacing: -2 }}>
            Keep every voice from your wedding day.
          </div>
          <div style={{ fontSize: 30, color: INK_SOFT, marginTop: 26 }}>
            Guests scan one code and leave a spoken message — no app, no account.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 110 }}>
          {wave.map((h, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: h / 2 + 14,
                borderRadius: 99,
                background: i % 3 === 0 ? ACCENT : LINE,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
