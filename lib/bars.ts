function hashStr(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function seededBars(seed: string, n: number): number[] {
  let s = hashStr(seed) || 1
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0
    const base = 0.18 + (s / 4294967296) * 0.82
    const env = 0.55 + 0.45 * Math.sin((i / n) * Math.PI * 3 + (s % 7))
    out.push(Math.max(0.14, Math.min(1, base * (0.6 + 0.4 * Math.abs(env)))))
  }
  return out
}
