import { seededBars } from "@/lib/bars"

const bars = seededBars("closing", 60)

export function CtaWave() {
  return (
    <div className="cta-wave reveal" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className={i % 3 === 0 ? "on" : undefined}
          style={{ height: Math.max(2, Math.round(h * 38)) + "px" }}
        />
      ))}
    </div>
  )
}
