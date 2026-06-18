"use client"

import { useQuery } from "convex/react"
import { jsPDF } from "jspdf"
import Link from "next/link"
import QRCode from "qrcode"
import { type CSSProperties, useEffect, useState } from "react"

import {
  Btn,
  Eyebrow,
  IconArrow,
  IconCheck,
  IconCopy,
  IconDownload,
} from "@/components/recorder/primitives"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useStoreUser } from "@/hooks/use-store-user"

const qrBtn: CSSProperties = {
  textDecoration: "none",
  border: "1.4px solid var(--aloud-line)",
  borderRadius: 999,
  padding: "10px 15px",
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "var(--font-hanken, system-ui)",
  color: "var(--aloud-ink)",
  background: "var(--aloud-paper)",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
}

export function ShareEvent({ eventId }: { eventId: Id<"events"> }) {
  const { ready } = useStoreUser()
  const event = useQuery(api.events.getById, ready ? { eventId } : "skip")

  const [shareUrl, setShareUrl] = useState("")
  const [qr, setQr] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!event?.slug) return
    const url = `${window.location.origin}/e/${event.slug}`
    void QRCode.toDataURL(url, {
      width: 480,
      margin: 1,
      color: { dark: "#211a14", light: "#fffaf4ff" },
    }).then((dataUrl) => {
      setShareUrl(url)
      setQr(dataUrl)
    })
  }, [event?.slug])

  if (!ready || event === undefined) {
    return <Centered>Loading…</Centered>
  }
  if (event === null) {
    return <Centered>You don&apos;t have access to this event.</Centered>
  }

  const copy = () => {
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const names = event.coupleNames ?? event.title
  const slug = event.slug
  function downloadPdf() {
    if (!qr) return
    const doc = new jsPDF({ unit: "pt", format: "a4" })
    const pageW = doc.internal.pageSize.getWidth()
    const qrSize = 248
    const x = (pageW - qrSize) / 2
    const top = 200
    doc.setDrawColor(216, 207, 193)
    doc.setLineWidth(1.2)
    doc.roundedRect(x - 46, top - 86, qrSize + 92, qrSize + 210, 18, 18)
    doc.setFont("times", "normal")
    doc.setTextColor(35, 26, 18)
    doc.setFontSize(30)
    doc.text(names, pageW / 2, top - 38, { align: "center" })
    doc.addImage(qr, "PNG", x, top, qrSize, qrSize)
    doc.setFontSize(11)
    doc.setTextColor(120, 110, 96)
    doc.text("SCAN TO LEAVE A VOICE MESSAGE", pageW / 2, top + qrSize + 40, {
      align: "center",
    })
    doc.setFontSize(10)
    doc.text(shareUrl, pageW / 2, top + qrSize + 62, { align: "center" })
    doc.save(`toastbook-${slug}-cards.pdf`)
  }

  return (
    <main
      className="aloud"
      style={{
        minHeight: "100dvh",
        background: "var(--aloud-paper)",
        color: "var(--aloud-ink)",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "48px 28px 70px",
          textAlign: "center",
        }}
      >
        {/* <div style={{ textAlign: "left" }}>
          <BackLink href={`/dashboard/${eventId}`}>Dashboard</BackLink>
        </div> */}
        <Eyebrow>You&apos;re live</Eyebrow>
        <h1
          style={{
            fontFamily: "var(--font-newsreader, Georgia, serif)",
            fontWeight: 400,
            fontSize: 44,
            letterSpacing: "-0.018em",
            margin: "14px 0 10px",
          }}
        >
          Share your guestbook.
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--aloud-ink-soft)",
            marginBottom: 38,
          }}
        >
          Put this code on the tables, or text the link to anyone who
          couldn&apos;t make it.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 26,
            textAlign: "left",
            alignItems: "stretch",
          }}
        >
          {/* QR card */}
          <div
            style={{
              border: "1.4px solid var(--aloud-line)",
              borderRadius: 18,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              background: "var(--aloud-paper-2)",
            }}
          >
            <div
              style={{
                background: "var(--aloud-paper)",
                padding: 16,
                borderRadius: 16,
                boxShadow: "var(--shadow-card)",
              }}
            >
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr}
                  alt="QR code"
                  width={176}
                  height={176}
                  style={{ display: "block" }}
                />
              ) : (
                <div style={{ width: 176, height: 176 }} />
              )}
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-newsreader, Georgia, serif)",
                  fontSize: 19,
                }}
              >
                {event.coupleNames ?? event.title}
              </div>
              <Eyebrow style={{ fontSize: 9, marginTop: 4 }}>
                Scan to leave a message
              </Eyebrow>
            </div>
          </div>

          {/* actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                border: "1.4px solid var(--aloud-line)",
                borderRadius: 18,
                padding: 18,
              }}
            >
              <Eyebrow style={{ fontSize: 9, marginBottom: 9 }}>
                Shareable link
              </Eyebrow>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: "var(--font-space-mono, monospace)",
                    fontSize: 14,
                    background: "var(--aloud-paper-2)",
                    border: "1.4px solid var(--aloud-line)",
                    borderRadius: 10,
                    padding: "11px 13px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {shareUrl}
                </div>
                <button
                  onClick={copy}
                  style={{
                    flexShrink: 0,
                    border: "none",
                    cursor: "pointer",
                    borderRadius: 999,
                    padding: "11px 16px",
                    fontSize: 13.5,
                    fontWeight: 600,
                    fontFamily: "var(--font-hanken, system-ui)",
                    background: "var(--aloud-ink)",
                    color: "var(--aloud-paper)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div
              style={{
                border: "1.4px solid var(--aloud-line)",
                borderRadius: 18,
                padding: 18,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  Download the QR code
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--aloud-ink-faint)",
                    marginTop: 2,
                  }}
                >
                  For screens and printed table cards.
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 9 }}>
                <a
                  href={qr || undefined}
                  download={`toastbook-${event.slug}.png`}
                  style={qrBtn}
                >
                  <IconDownload size={15} /> PNG
                </a>
                <button
                  onClick={downloadPdf}
                  style={{
                    ...qrBtn,
                    cursor: "pointer",
                    background: "var(--aloud-paper)",
                  }}
                >
                  <IconDownload size={15} /> PDF cards
                </button>
              </div>
            </div>

            <div style={{ flex: 1 }} />
            <Link
              href={`/dashboard/${eventId}`}
              style={{ textDecoration: "none" }}
            >
              <Btn variant="accent" size="lg" block>
                Open your dashboard <IconArrow size={18} />
              </Btn>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

export function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="aloud"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--aloud-paper)",
        color: "var(--aloud-ink-soft)",
        fontFamily: "var(--font-hanken, system-ui)",
      }}
    >
      {children}
    </div>
  )
}
