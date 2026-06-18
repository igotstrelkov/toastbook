"use client"

import Uppy from "@uppy/core"
import Transloadit, { type AssemblyOptions } from "@uppy/transloadit"
import { useAction } from "convex/react"
import { useRef, useState } from "react"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Eyebrow, IconImage } from "@/components/recorder/primitives"

// Cover photo upload: signed Uppy → Transloadit (/image/resize) → R2, then
// finalize attaches the key to the event. The reactive getById query updates
// coverUrl automatically once the key is set.
export function CoverUpload({
  eventId,
  coverUrl,
}: {
  eventId: Id<"events">
  coverUrl: string | null
}) {
  const getOptions = useAction(api.host.getEventAssetOptions)
  const finalize = useAction(api.host.finalizeEventAsset)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setErr(null)
    const uppy = new Uppy({ autoProceed: false }).use(Transloadit, {
      waitForEncoding: true, // host is present; wait so finalize finds the key
      assemblyOptions: async () => {
        const { assemblyOptions } = await getOptions({ eventId, kind: "cover" })
        return assemblyOptions as unknown as AssemblyOptions
      },
    })
    try {
      uppy.addFile({ name: file.name, type: file.type, data: file })
      const result = (await uppy.upload()) as {
        transloadit?: Array<{ assembly_id?: string }>
      }
      const assemblyId = result?.transloadit?.[0]?.assembly_id
      if (!assemblyId) throw new Error("no assembly")
      await finalize({ eventId, kind: "cover", assemblyId })
    } catch {
      setErr("Upload failed — please try a different image.")
    } finally {
      uppy.destroy()
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        border: "1.4px solid var(--aloud-line)",
        borderRadius: 18,
        padding: 18,
        marginBottom: 22,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 96,
          height: 64,
          borderRadius: 12,
          overflow: "hidden",
          flexShrink: 0,
          background:
            "repeating-linear-gradient(135deg, color-mix(in oklab, var(--aloud-paper-3), #000 2%) 0 9px, var(--aloud-paper-2) 9px 18px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--aloud-ink-faint)",
        }}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <IconImage size={20} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Eyebrow style={{ fontSize: 9 }}>Cover photo</Eyebrow>
        <div style={{ fontSize: 13.5, color: "var(--aloud-ink-soft)", marginTop: 4 }}>
          {coverUrl
            ? "Shown to guests on the recorder."
            : "Add a photo guests see when they open your guestbook."}
          {err && <span style={{ color: "var(--aloud-accent)" }}> · {err}</span>}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        style={{
          flexShrink: 0,
          border: "1.4px solid var(--aloud-line)",
          background: "var(--aloud-paper)",
          borderRadius: 999,
          padding: "10px 16px",
          fontSize: 13.5,
          fontWeight: 600,
          fontFamily: "var(--font-hanken, system-ui)",
          color: "var(--aloud-ink)",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Uploading…" : coverUrl ? "Change" : "Add cover"}
      </button>
    </div>
  )
}
