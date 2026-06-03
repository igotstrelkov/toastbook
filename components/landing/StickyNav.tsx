"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

export function StickyNav() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = ref.current
    if (!nav) return
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 12)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <nav className="aloud-nav" ref={ref}>
      <div className="nav-brand">
        <span className="mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <path d="M3 12h2M5 8v8M8 5v14M11 9v6M14 4v16M17 8v8M20 10v4M23 11v2"/>
          </svg>
        </span>
        <span className="name">Aloud</span>
      </div>
      <div className="nav-links">
        <a href="#how">How it works</a>
        <a href="#voices">Listen</a>
        <a href="#pricing">Pricing</a>
        <a href="#faq">FAQ</a>
      </div>
      <div className="nav-cta">
        <Button variant="accent" className="rounded-full h-9 px-5 text-sm" asChild>
          <a href="#">Create your guestbook</a>
        </Button>
      </div>
    </nav>
  )
}
