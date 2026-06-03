import type { Metadata } from "next"
import { Inter, Newsreader, Hanken_Grotesk, Space_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Aloud — A voice guestbook for weddings",
  description:
    "Guests scan one code and leave a spoken message — no app, no account. Keep a private gallery of every voice from your wedding day.",
  openGraph: {
    title: "Aloud — A voice guestbook for weddings",
    description:
      "Guests scan one code and leave a spoken message — no app, no account. Keep a private gallery of every voice from your wedding day.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aloud — A voice guestbook for weddings",
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
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased font-sans",
        inter.variable,
        newsreader.variable,
        hanken.variable,
        spaceMono.variable,
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
