"use client"

import { useEffect } from "react"

export function RevealScript() {
  useEffect(() => {
    document.documentElement.classList.add("js")

    const els = document.querySelectorAll<HTMLElement>(".reveal")

    // stagger step + quote groups
    let idx = 0
    document.querySelectorAll<HTMLElement>(".step.reveal, .quote.reveal").forEach((el) => {
      el.style.transitionDelay = `${(idx % 3) * 90}ms`
      idx++
    })

    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in")
            io.unobserve(en.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])

  return null
}
