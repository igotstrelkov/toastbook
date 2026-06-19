import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata } from "next"
import { Hanken_Grotesk, Inter, Newsreader, Space_Mono } from "next/font/google"
import Script from "next/script"

import { ConvexClientProvider } from "@/components/ConvexClientProvider"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import "./globals.css"

export const metadata: Metadata = {
  title: "Toastbook — A voice guestbook for weddings",
  description:
    "Guests scan one code and leave a spoken message — no app, no account. Keep a private gallery of every voice from your wedding day.",
  openGraph: {
    title: "Toastbook — A voice guestbook for weddings",
    description:
      "Guests scan one code and leave a spoken message — no app, no account. Keep a private gallery of every voice from your wedding day.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Toastbook — A voice guestbook for weddings",
    description:
      "Guests scan one code and leave a spoken message — no app, no account.",
  },
}

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
})

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-hanken",
  display: "swap",
})

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-space-mono",
  display: "swap",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The waitlist form only renders when Clerk is configured; without a key the
  // app still builds and the modal shows a setup hint instead.
  const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const plausibleSrc = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC
  const gadsId = process.env.NEXT_PUBLIC_GADS_ID

  const tree = (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "font-sans antialiased",
        inter.variable,
        newsreader.variable,
        hanken.variable,
        spaceMono.variable
      )}
    >
      <body>
        {/* Plausible — cookieless analytics + custom events (PlayedSample,
            SignupCompleted). The site-specific script URL carries the domain
            config; the shim queues plausible(...) calls and runs init() so
            pageviews fire once the script loads. */}
        {plausibleSrc && (
          <>
            <Script src={plausibleSrc} strategy="afterInteractive" />
            <Script id="plausible-init" strategy="afterInteractive">
              {`window.plausible = window.plausible || function () { (plausible.q = plausible.q || []).push(arguments) };
plausible.init = plausible.init || function (i) { plausible.o = i || {} };
plausible.init();`}
            </Script>
          </>
        )}
        {/* Google tag (gtag.js) — Google Ads conversion on completed signup. */}
        {gadsId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gadsId}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gadsId}');`}
            </Script>
          </>
        )}
        <ThemeProvider>
          {/* Convex is wired to Clerk when configured; guests stay anonymous
              and still reach public functions. */}
          {clerkEnabled ? (
            <ConvexClientProvider>{children}</ConvexClientProvider>
          ) : (
            children
          )}
        </ThemeProvider>
      </body>
    </html>
  )

  return clerkEnabled ? (
    <ClerkProvider
      signInUrl="/sign-in"
      // Force (not fallback) so we always land on the dashboard, even when
      // sign-in starts from "/" (which would otherwise return there).
      signInForceRedirectUrl="/dashboard"
      // New signups land on /thanks (fires the conversion) then go on to the
      // dashboard; returning sign-ins skip it.
      signUpForceRedirectUrl="/thanks"
    >
      {tree}
    </ClerkProvider>
  ) : (
    tree
  )
}
