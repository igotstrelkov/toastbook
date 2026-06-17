# Toastbook — Stages 1 & 2, fully specified (ready-to-paste LLM prompts)

These expand Stages 1–2 of the implementation plan into self-contained build prompts that resolve the four Severity‑1 gaps from the audit (data contracts, R2 serving model, the Transloadit step config, and webhook‑as‑source‑of‑truth). Stages 1–2 contain all four risks, so getting these right is most of the battle.

**How to use:** for each stage, paste (1) the **Global context & guardrails** block from the main plan, (2) the **Shared resolved decisions** + **Env manifest** + **Schema** sections below, and (3) the single **Stage prompt**. Tell the model: *implement only this stage, in full, then stop.*

---

## Shared resolved decisions (apply to both stages)

**R2 serving model — RESOLVED.** Use a **public R2 bucket bound to a custom domain** (e.g. `media.toastbook.co`). Transloadit writes outputs under **unguessable keys**; the app stores the **object keys** (not URLs) and derives playable URLs as `${MEDIA_BASE_URL}/${key}`. Rationale: free egress, works directly in `<audio src>`, supports shareable links, and deletion is a simple `DeleteObject` by key. Privacy is by unguessable key (the same capability‑token model as the event slug). *Tradeoff:* a leaked URL is accessible; if stronger privacy is needed later, move to a private bucket + presigned GET URLs served via a Cloudflare Worker. Do not store static public URLs in the DB — store keys, derive URLs on read.

**Transloadit — RESOLVED (and verified in build, 2026‑06‑17).** Steps are **defined server‑side** (the client never supplies steps). Use **inline `steps`** passed to the component's `createAssemblyOptions` (the documented pattern). The guest‑audio step graph **as actually built and verified end‑to‑end** (see `convex/guest.ts`):

```js
// server-side constant — DO NOT accept these from the client
const GUEST_AUDIO_STEPS = {
  ":original": { robot: "/upload/handle" },
  normalized: {
    use: ":original",
    robot: "/audio/encode",
    preset: "mp3",
    ffmpeg_stack: "v6.0.0",
    ffmpeg: { af: "loudnorm=I=-16:TP=-1.5:LRA=11" }, // EBU R128
  },
  stored_original: {
    use: ":original",
    robot: "/cloudflare/store",   // R2-native robot (NOT /s3/store — see note)
    credentials: "toastbook",     // a Transloadit *Cloudflare* Template Credential
    path: "events/${fields.eventId}/${assembly.id}/original.${file.ext}",
  },
  stored_normalized: {
    use: "normalized",
    robot: "/cloudflare/store",
    credentials: "toastbook",
    path: "events/${fields.eventId}/${assembly.id}/normalized.mp3",
  },
};
```

> **Why `/cloudflare/store`, not `/s3/store`.** R2 is S3-compatible, so `/s3/store` *seems* right — but it carries AWS region semantics and defaults to `region: us-east-1`, which R2 rejects (`AuthorizationHeaderMalformed`; R2 only accepts `wnam/enam/weur/eeur/apac/oc/auto`), and Transloadit's S3 Template Credential exposed no region field to override it. The R2-native **`/cloudflare/store`** robot resolves bucket/region from a **Cloudflare** Template Credential and just works. The credential must be the **Cloudflare** service type (fields: bucket, access key, secret, account id), **not** Amazon S3 — that's also why there's no region field to set.

**Result‑row shape — RESOLVED.** `listResults({ assemblyId })` returns one row per content step, keyed by **`stepName`** (the *source* step, i.e. **`normalized`** and **`:original`** — NOT `stored_normalized`/`stored_original`). Each row carries `name`/`size`/`mime`/**`sslUrl`** (top‑level, camelCase) plus the raw output under `raw` (where `raw.ssl_url` is the same URL). The **object key** = the `sslUrl` pathname minus its leading slash. So:

- `normalizedKey` ← key from the `normalized` row's `sslUrl`
- `originalKey` ← key from the `:original` row's `sslUrl`

⚠️ **Quirk:** `/cloudflare/store` **prepends the bucket name** to `path`, so a `path` of `events/…/normalized.mp3` is stored under the key `toastbook/events/…/normalized.mp3`. Store the key exactly as returned and derive the URL as `${MEDIA_BASE_URL}/${key}` — verified publicly playable (`HTTP 200`, `audio/mpeg`).

> **VERIFY note (now resolved for this build):** `/audio/encode` with `ffmpeg.af` loudnorm + `ffmpeg_stack: v6.0.0` works; `path` vars `${fields.*}`/`${assembly.id}`/`${file.ext}` resolve correctly. The only adjustment vs. the original spec was `/s3/store` → `/cloudflare/store` (above).

**Webhook is the source of truth — RESOLVED.** Pass `fields: { eventId, guestName }` into the assembly. The client's `registerRecording` is an **optimistic** insert (so the host sees a "processing" row instantly) but is NOT authoritative. The webhook follow-up **upserts** the `recordings` row keyed by `assemblyId` — creating it if the client never called `registerRecording` (tab closed mid‑upload). This prevents lost recordings.

> **VERIFY:** the exact mechanism to run custom logic after the component persists webhook results. Intended design: the `convex/http.ts` route calls the component's `handleWebhookRequest` (mode `queue`) → component persists results → your `finalizeRecording` runs and reads `listResults({ assemblyId })`. If the README exposes no post‑persist hook, implement a **reconciler**: a Convex scheduled/cron function that periodically finds `processing` rows older than ~30s and calls `listResults`/`getAssemblyStatus` to finalize or fail them. Build the reconciler regardless — it is your safety net.

**Duration — RESOLVED.** Compute `durationSeconds` from a **client-side elapsed timer** during recording. Do NOT read it from the `MediaRecorder` blob (webm blobs frequently report `Infinity`/`NaN`).

**Function types.** Reads = `query` (reactive, no fetch). Writes = `mutation` (no external fetch). Anything touching a secret or an external service (Transloadit signing, R2 SDK, Stripe) = `action` (Node action with `"use node"` when using node-only SDKs).

---

## Env manifest (Stages 1–2)

Client (`.env.local`): `NEXT_PUBLIC_CONVEX_URL`.
Convex env (`npx convex env set …`):
- `TRANSLOADIT_KEY`, `TRANSLOADIT_SECRET`
- `MEDIA_BASE_URL` (e.g. `https://media.toastbook.co`)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (for the deletion SDK; deletion lands in Stage 3 but set these now)

**[MANUAL] before Stage 1:** create the R2 bucket; enable public access (custom domain or `pub-*.r2.dev`) → set `MEDIA_BASE_URL`; in Transloadit, create a **Cloudflare** Template Credential named `toastbook` (bucket + R2 access key/secret + account id). It must be the **Cloudflare** service type, not Amazon S3 (see the `/cloudflare/store` note above).

---

## Canonical schema (created in Stage 2; Stage 1 uses a minimal subset)

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
  }).index("by_clerk_id", ["clerkId"]),

  events: defineTable({
    userId: v.optional(v.id("users")),   // tightened to required in Stage 4
    title: v.string(),
    coupleNames: v.optional(v.string()),
    eventDate: v.string(),               // ISO date
    coverKey: v.optional(v.string()),    // R2 key
    greetingKey: v.optional(v.string()), // R2 key
    slug: v.string(),                    // unguessable capability token
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("closed")),
    isPaid: v.boolean(),
    stripeSessionId: v.optional(v.string()),
    guestCap: v.optional(v.number()),    // abuse/cost ceiling (Stage 8), not a paywall
  })
    .index("by_user", ["userId"])
    .index("by_slug", ["slug"]),

  recordings: defineTable({
    eventId: v.id("events"),
    assemblyId: v.string(),
    guestName: v.optional(v.string()),
    originalKey: v.optional(v.string()),     // R2 key
    normalizedKey: v.optional(v.string()),   // R2 key (mp3) — player source
    durationSeconds: v.number(),
    status: v.union(
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
  })
    .index("by_event", ["eventId"])
    .index("by_assembly", ["assemblyId"]),
});
```

**Status state machine:** `processing` → `ready` (webhook found stored outputs) | `failed` (assembly error, or reconciler timeout). The read query returns a derived `normalizedUrl = ${MEDIA_BASE_URL}/${normalizedKey}` **only** when `status === "ready"`.

---

## STAGE 1 PROMPT — Guest recorder + Transloadit normalization (vertical slice)

**Objective:** prove the riskiest path end to end: record in the browser → upload to Transloadit → normalized mp3 stored in R2 → play it back. No real events table yet; use a hardcoded `TEST_EVENT` id string in `fields`.

**Honor the Shared resolved decisions above** (R2 serving, server-side `GUEST_AUDIO_STEPS`, duration-from-timer). **Hard rules from the global block apply** (secret never on client; player uses normalized mp3 only).

**Build these files:**
- `convex/convex.config.ts` — `app.use(transloadit)`.
- `convex/transloadit.ts` — `export const { createAssemblyOptions, queueWebhook, listResults } = makeTransloaditAPI(components.transloadit);`
- `convex/http.ts` — route `POST /transloadit/webhook` → `handleWebhookRequest(request, { mode: "queue", runAction: (args) => ctx.runAction(api.transloadit.queueWebhook, args) })`.
- `convex/guest.ts` — **action** `getGuestAssemblyOptions`:
  - `args: { guestName: v.optional(v.string()) }` (slug added in Stage 2)
  - returns `{ assemblyOptions }`
  - implementation: call `ctx.runAction(api.transloadit.createAssemblyOptions, { steps: GUEST_AUDIO_STEPS, fields: { eventId: "TEST_EVENT", guestName: args.guestName ?? "" } })` and return its `assemblyOptions`.
- Client recorder route `app/e/[slug]/page.tsx` (+ a `Recorder` client component):
  - `getUserMedia({ audio: true })` triggered by a tap; pick a supported mime via `MediaRecorder.isTypeSupported` (try `audio/mp4`, then `audio/webm`).
  - Track elapsed seconds with a `setInterval`; enforce a 60s cap; show timer + a level meter.
  - Stop → preview `<audio>` of the local blob (this local preview MAY use the original blob; the *gallery* may not) → Keep / Re-record.
  - On Send: configure Uppy with `@uppy/transloadit` (`waitForEncoding: true`) and `assemblyOptions: async () => { const { assemblyOptions } = await convex.action(api.guest.getGuestAssemblyOptions, { guestName }); return assemblyOptions; }`; add the recorded blob as an Uppy file; upload.
  - Capture the `assemblyId` from the Uppy Transloadit assembly events (log it for now).
- A temporary results panel that calls `listResults` for the assembly and plays the `normalized` mp3 URL.

**Acceptance criteria (must all pass):**
1. On a **real iPhone (Safari)** and a **real Android (Chrome)**: record → send → the normalized **mp3** plays back from its `${MEDIA_BASE_URL}` URL.
2. The Transloadit secret never appears in any client bundle or network payload (options are signed server-side).
3. The stored objects exist in R2 under `events/TEST_EVENT/<assemblyId>/normalized.mp3` and `…/original.<ext>`.

**Watch-outs:** mic permission must be requested inside the tap handler (iOS blocks otherwise); handle permission denial with a clear message; the local preview uses the in-memory blob (fine), but never wire the gallery player to a raw `webm`.

**Stop after Stage 1. Report any manual steps and any place the Transloadit step config needed adjusting against current docs.**

---

## STAGE 2 PROMPT — Data model & guest persistence

**Objective:** real events and recordings, with the webhook as the authoritative source of truth.

**Honor the Shared resolved decisions and the Canonical schema above.**

**Build these files / changes:**
- `convex/schema.ts` — the canonical schema above.
- A one-off seed (script or internal mutation) creating one `active` event with a known `slug` for testing.
- `convex/events.ts` — **query** `getEventBySlug`:
  - `args: { slug: v.string() }`
  - returns `{ _id, title, coupleNames, eventDate, coverUrl, greetingUrl, status } | null` where `coverUrl/greetingUrl` are derived from keys via `MEDIA_BASE_URL`.
  - returns `null` (or throws a not-found) unless `status === "active"`. Never returns any other event's data.
- `convex/guest.ts` — harden `getGuestAssemblyOptions`:
  - `args: { slug: v.string(), guestName: v.optional(v.string()) }`
  - look up the event by slug (via `ctx.runQuery`); require it exists and is `active`, else throw.
  - pass `fields: { eventId: <the event _id>, guestName }` into `GUEST_AUDIO_STEPS`.
- `convex/recordings.ts`:
  - **mutation** `registerRecording` — `args: { slug, assemblyId, guestName?, durationSeconds }`; validate slug→active; **idempotent upsert** by `assemblyId` (if a row exists, no-op); insert `{ eventId, assemblyId, guestName, durationSeconds, status: "processing" }`. This is optimistic only.
  - **internal mutation** `finalizeRecording` — `args: { assemblyId }`; read `listResults({ assemblyId })`; extract `normalizedKey` from the `stored_normalized` result and `originalKey` from `stored_original` (parse the stored object key from the result's path/url); **upsert** the row by `assemblyId` (create it from `fields.eventId`/`fields.guestName` if missing); set keys + `status: "ready"`. Idempotent: if already `ready`, no-op. On missing/zero outputs, set `failed`.
  - **query** `listByEvent` — `args: { eventId }`; reactive; returns each recording with a derived `normalizedUrl` (only when `ready`) and never an `originalUrl` for the player.
- Wire the webhook follow-up: after `queueWebhook` persists results, trigger `finalizeRecording({ assemblyId })`. **If no post-persist hook exists, also add** a Convex **cron** reconciler that finalizes/fails `processing` rows older than ~30s via `listResults`/`getAssemblyStatus` (see VERIFY note above). Build the reconciler either way.
- Update the Stage 1 recorder to call `registerRecording` on the Uppy "assembly created" event, passing the real `slug` + timer-derived `durationSeconds`.

**Acceptance criteria (must all pass):**
1. Recording from `/e/{slug}` creates a `processing` row that transitions to `ready` with a playable `normalizedKey` after the webhook.
2. **Lost-recording test:** simulate the client never calling `registerRecording` (skip that call) — the webhook/reconciler still creates a `ready` row from `fields`. No recording is lost.
3. **Idempotency test:** replaying the Transloadit webhook does not duplicate or corrupt the row.
4. `getEventBySlug` returns nothing for a non-active or non-existent slug.

**Watch-outs:** queries cannot do external fetches or use node-only SDKs — keep `listResults` reads and any SDK use in actions/mutations as appropriate; derive URLs from keys in the query using `process.env.MEDIA_BASE_URL`. Keep `registerRecording` and `finalizeRecording` both keyed on `assemblyId` so they converge regardless of order.

**Stop after Stage 2.**

---

## Honesty flags (what to confirm against current docs while building)

1. **Transloadit robot params** — RESOLVED in build: `/audio/encode` `ffmpeg.af` loudnorm + `ffmpeg_stack: v6.0.0` work; use **`/cloudflare/store`** (R2-native) with a **Cloudflare** Template Credential, NOT `/s3/store` (which forces an AWS region R2 rejects); `path` vars confirmed. Re-verify only if robots change.
2. **`@transloadit/convex` (pre‑1.0)** — confirm `createAssemblyOptions` accepts `{ steps, fields }`, the `listResults` row shape (where the stored object key/path lives), and whether a post‑webhook hook exists. The cron reconciler is the safety net if it doesn't.
3. **R2 public custom domain** — confirm the bucket is bound to `MEDIA_BASE_URL` and objects are publicly readable at `${MEDIA_BASE_URL}/${key}`.
4. **Convex HTTP actions are publicly reachable in dev**, so the Transloadit webhook works without a tunnel — but confirm the deployed webhook URL is registered with the assembly/notify config.
