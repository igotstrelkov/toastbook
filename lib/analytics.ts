// Analytics helpers — SSR-safe; no-op when the globals aren't loaded.
// Plausible (cookieless) for the funnel + a Google Ads conversion on signup.

const GADS_ID = process.env.NEXT_PUBLIC_GADS_ID
const GADS_SIGNUP_LABEL = process.env.NEXT_PUBLIC_GADS_SIGNUP_LABEL

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void
    gtag?: (...args: unknown[]) => void
  }
}

// Dev-only firing log — confirms events locally without the Ads dashboard delay.
// Stripped from production builds (NODE_ENV is inlined at build time).
function debug(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[analytics]", ...args)
  }
}

// Funnel: guest played one of the sample voices.
export function trackPlaySample(): void {
  if (typeof window === "undefined") return
  debug("PlayedSample")
  window.plausible?.("PlayedSample")
}

// Funnel: host opened the sign-up modal — intent, fired before completion.
// Splits the funnel so we can see CTA-click drop-off vs in-modal drop-off.
export function trackSignupStarted(): void {
  if (typeof window === "undefined") return
  debug("StartedSignup")
  window.plausible?.("StartedSignup")
}

// Funnel: a signup completed (fired once on the /thanks page). Also fires the
// Google Ads conversion.
export function trackSignupCompleted(): void {
  if (typeof window === "undefined") return
  debug("SignupCompleted")
  window.plausible?.("SignupCompleted")
  if (GADS_ID && GADS_SIGNUP_LABEL) {
    const sendTo = `${GADS_ID}/${GADS_SIGNUP_LABEL}`
    debug("gtag conversion", sendTo)
    window.gtag?.("event", "conversion", { send_to: sendTo })
  }
}
