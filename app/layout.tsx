import type { Metadata } from "next"
import { Hanken_Grotesk, Inter, Newsreader, Space_Mono } from "next/font/google"

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
  return (
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
