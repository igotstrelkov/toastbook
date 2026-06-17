import type { Metadata } from "next"
import { Hanken_Grotesk, Inter, Newsreader, Space_Mono } from "next/font/google"
import Script from "next/script"
import { ClerkProvider } from "@clerk/nextjs"

import { ConvexClientProvider } from "@/components/ConvexClientProvider"
import { ThemeProvider } from "@/components/theme-provider"
import { WaitlistProvider } from "@/components/landing/WaitlistModal"
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
        {/* Google tag (gtag.js) — Google Ads conversion tracking, site-wide */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18247886696"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18247886696');
          `}
        </Script>
        <ThemeProvider>
          <WaitlistProvider clerkEnabled={clerkEnabled}>
            {/* Convex is wired to Clerk when configured; guests stay anonymous
                and still reach public functions. */}
            {clerkEnabled ? (
              <ConvexClientProvider>{children}</ConvexClientProvider>
            ) : (
              children
            )}
          </WaitlistProvider>
        </ThemeProvider>
      </body>
    </html>
  )

  return clerkEnabled ? (
    <ClerkProvider
      signInUrl="/sign-in"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {tree}
    </ClerkProvider>
  ) : (
    tree
  )
}
