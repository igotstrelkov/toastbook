# Toastbook — Ready-to-Paste Stage Prompts (0–9)

Feed these to a coding LLM **in order**, one at a time. Run each stage's acceptance tests before moving to the next.

## How to use
1. **Load the STANDING CONTEXT block once** — paste it as your project's `CLAUDE.md` (Claude Code) / project rules (Cursor), or as your first message. It carries the rules, stack, design tokens, env names, and verify-flags so the stage prompts stay focused.
2. **Paste Stage 0, let it finish, run its tests. Then Stage 1. And so on.** Each stage prompt is self-contained for its work and ends with "implement only this stage, then stop."
3. **Do the `[MANUAL]` steps yourself** (accounts, dashboards, env vars).

---

## ▶ STANDING CONTEXT (paste once, keep loaded)

> **Project:** Toastbook — an audio guestbook for weddings. A host creates an event, shares a QR/link; guests record a voice message in the browser (no app, no account); each message is loudness-normalized to mp3 and stored; the host gets a private realtime gallery to play, delete, and download. €49 one-time unlock per event. Scope = Digital tier MVP.
>
> **Stack:** Next.js (App Router, TypeScript) · Convex (DB, functions, realtime, HTTP webhooks) · Clerk (host auth only) · Transloadit via `@transloadit/convex` (upload + loudnorm→mp3 → Cloudflare R2) · Cloudflare R2 (media, public bucket on a custom domain) · Stripe (one-time payment) · Resend via `@convex-dev/resend` · `@convex-dev/rate-limiter`. No Inngest.
>
> **Architecture:** Browser records (`MediaRecorder`) → Uppy + tus uploads directly to Transloadit using server-signed options → Transloadit runs server-defined steps (loudnorm→mp3), stores original + normalized to R2 under unguessable keys → Transloadit webhook → Convex HTTP action (component verifies signature) → finalize upserts the `recordings` row by `assemblyId`. Convex holds metadata only; R2 holds files; player reads normalized mp3 via `${MEDIA_BASE_URL}/${key}`.
>
> **HARD RULES — never violate:**
> 1. Never expose secrets client-side; sign Transloadit options in a Convex **action**.
> 2. Guests are NOT authenticated. Guest functions are public but MUST validate the event `slug` + `active` status, invoke only **server-defined** Transloadit steps, and be rate-limited.
> 3. The audio player plays `normalizedUrl` (mp3) ONLY; show a processing state while `status==="processing"`; NEVER play `originalUrl` (may be webm, fails on iOS).
> 4. Audio lives in R2 by object KEY; Convex stores metadata/keys only; derive URLs from `${MEDIA_BASE_URL}/${key}` on read.
> 5. All webhooks idempotent: match Transloadit by `assemblyId`, Stripe by `stripeSessionId`; ignore duplicates/out-of-order.
> 6. Payment gates download/keep — NEVER recording.
> 7. Keep originals; deletion removes the Convex row AND both R2 objects by key.
> 8. The webhook is the source of truth for recordings — upsert by `assemblyId` using assembly `fields:{eventId,guestName}`; the client's `registerRecording` is optimistic only and may never fire.
> 9. Duration comes from a client-side timer, never the `MediaRecorder` blob.
> 10. GDPR: consent notice before recording; deletion/erasure path; no privacy policy → no real recordings.
>
> **Function types:** `query` = reactive reads (no fetch); `mutation` = writes (no fetch); `action` = secrets/external/node SDKs (`"use node"` for `@aws-sdk/client-s3`).
>
> **Design tokens (match the provided design HTML):** background cream `#e8e0d2`, surfaces `#fffaf4`, accent terracotta `#b65f3f`; `--font-display` serif (Cormorant Garamond / Newsreader), `--font-ui` Hanken Grotesk, `--font-mono` Space Mono. Warm, editorial, generous whitespace; mobile-first recorder.
>
> **Env vars (names only):** Client `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Convex `TRANSLOADIT_KEY`, `TRANSLOADIT_SECRET`, `MEDIA_BASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`.
>
> **VERIFY against current docs (don't trust training data):** `@transloadit/convex` is pre-1.0 — confirm exports (`makeTransloaditAPI`→`createAssemblyOptions`,`queueWebhook`,`listResults`; `handleWebhookRequest`), `createAssemblyOptions({steps,fields})`, and `listResults` row shape. Transloadit robots evolve — `/audio/encode` `ffmpeg.af` loudnorm + `ffmpeg_stack: v6.0.0` verified; store to R2 with **`/cloudflare/store`** + a Cloudflare Template Credential (NOT `/s3/store`), `path` vars verified. Clerk: use `clerkMiddleware`. Stripe: signature verify needs the **raw body**. Convex HTTP actions are public in dev (webhooks work without a tunnel).

---

## ▶ STAGE 0 — Scaffold & environment

> Implement Stage 0 of Toastbook (see STANDING CONTEXT). 
> **Objective:** a running Next.js + Convex app with all dependencies and the design tokens applied.
> **Build:** scaffold Next.js (App Router, TypeScript); init Convex (empty schema); install `convex`, `@clerk/nextjs`, `@transloadit/convex`, `@uppy/core @uppy/transloadit @uppy/react`, `@convex-dev/resend`, `@convex-dev/rate-limiter`, `stripe`, `qrcode`, `@aws-sdk/client-s3`. Set up the design tokens from STANDING CONTEXT as CSS variables / Tailwind theme (colors + the three font families). Add a health-check page that renders a value from a trivial Convex query.
> **[MANUAL]:** create the Convex project; put its URL in `.env.local`.
> **Acceptance:** `next dev` and `npx convex dev` both run; the health-check page shows live Convex data; the design tokens are available globally.
> Implement only this stage, then stop. List any manual steps.

---

## ▶ STAGE 1 — Guest recorder + Transloadit normalization (riskiest — do first)

> Implement Stage 1 of Toastbook (see STANDING CONTEXT). Honor hard rules 1, 2, 3, 9.
> **Objective:** prove the riskiest path end to end: record in the browser → upload to Transloadit → normalized mp3 stored in R2 → play it back. No events table yet; use a hardcoded `TEST_EVENT` id in `fields`.
> **Decisions to honor:** server-defined steps only (below); derive playable URL from the stored key + `MEDIA_BASE_URL`; never wire the gallery player to a raw blob.
> **Server-side step constant:**
> ```js
> // VERIFIED IN BUILD: use /cloudflare/store (R2-native), NOT /s3/store.
> // /s3/store defaults region us-east-1 which R2 rejects. See stages-1-2-detailed.md.
> const GUEST_AUDIO_STEPS = {
>   ":original": { robot: "/upload/handle" },
>   normalized: { use: ":original", robot: "/audio/encode", preset: "mp3",
>     ffmpeg_stack: "v6.0.0", ffmpeg: { af: "loudnorm=I=-16:TP=-1.5:LRA=11" } },
>   stored_original: { use: ":original", robot: "/cloudflare/store", credentials: "toastbook",
>     path: "events/${fields.eventId}/${assembly.id}/original.${file.ext}" },
>   stored_normalized: { use: "normalized", robot: "/cloudflare/store", credentials: "toastbook",
>     path: "events/${fields.eventId}/${assembly.id}/normalized.mp3" },
> };
> ```
> **Build:** `convex/convex.config.ts` (`app.use(transloadit)`); `convex/transloadit.ts` (`makeTransloaditAPI` → `createAssemblyOptions`, `queueWebhook`, `listResults`); `convex/http.ts` webhook route (`handleWebhookRequest`, `mode:"queue"`). A Convex **action** `getGuestAssemblyOptions({ guestName? })` returning signed options for `GUEST_AUDIO_STEPS` with `fields:{ eventId:"TEST_EVENT", guestName }`. Client `app/e/[slug]/page.tsx` recorder: `getUserMedia({audio:true})` on tap; `MediaRecorder.isTypeSupported` (try `audio/mp4` then `audio/webm`); timer + level meter + 60s cap; Stop → local preview → Keep/Re-record → optional name → Send via Uppy (`@uppy/transloadit`, tus) using `assemblyOptions: async () => (await convex.action(api.guest.getGuestAssemblyOptions,{guestName})).assemblyOptions`. Capture `assemblyId` from Uppy events. A temporary panel calls `listResults` and plays the normalized mp3.
> **[MANUAL]:** Transloadit **Cloudflare** Template Credential named `toastbook` (bucket + R2 access key/secret + account id — NOT an Amazon S3 credential); env `TRANSLOADIT_KEY`, `TRANSLOADIT_SECRET`, `MEDIA_BASE_URL` (R2 public URL — custom domain or `pub-*.r2.dev`); R2 bucket with public access enabled.
> **Acceptance:** on a **real iPhone (Safari)** and **real Android (Chrome)**, record→send→the normalized mp3 plays from its `${MEDIA_BASE_URL}` URL; the Transloadit secret never appears in any client payload; objects exist in R2 under `events/TEST_EVENT/<assemblyId>/`.
> Implement only this stage, then stop. Flag any Transloadit param you had to adjust vs current docs.

---

## ▶ STAGE 2 — Data model & guest persistence

> Implement Stage 2 of Toastbook (see STANDING CONTEXT). Honor hard rules 2, 4, 5, 8, 9.
> **Objective:** real events and recordings, with the webhook as the authoritative source of truth.
> **Schema (`convex/schema.ts`):** `users{clerkId,email}` idx `by_clerk_id`; `events{userId?,title,coupleNames?,eventDate,coverKey?,greetingKey?,slug,status(draft|active|closed),isPaid,stripeSessionId?,guestCap?}` idx `by_user`,`by_slug`; `recordings{eventId,assemblyId,guestName?,originalKey?,normalizedKey?,durationSeconds,status(processing|ready|failed)}` idx `by_event`,`by_assembly`. Validators on every field.
> **Build:** a seed creating one `active` test event with a known slug. **query** `getEventBySlug({slug})` → returns display fields (derive `coverUrl`/`greetingUrl` from keys), only if `active`, never leaks other events. Harden **action** `getGuestAssemblyOptions({slug,guestName?})`: look up event by slug via `ctx.runQuery`, require `active`, pass `fields:{eventId,guestName}`. **mutation** `registerRecording({slug,assemblyId,guestName?,durationSeconds})`: optimistic, idempotent upsert by `assemblyId`, status `processing`. **internal mutation** `finalizeRecording({assemblyId})`: read `listResults`, extract `normalizedKey` (from `stored_normalized`) + `originalKey` (from `stored_original`), upsert by `assemblyId` (create from `fields` if missing), set `ready`; idempotent; set `failed` if no outputs. **query** `listByEvent({eventId})`: reactive, derives `normalizedUrl` only when `ready`, never returns `originalUrl`. Wire `finalizeRecording` to run after `queueWebhook`; **also build a Convex cron reconciler** that finalizes/fails `processing` rows older than ~30s via `listResults`/`getAssemblyStatus`. Update the recorder to call `registerRecording` with the real `slug` + timer-derived `durationSeconds`.
> **Acceptance:** recording creates a `processing` row that becomes `ready` with a playable `normalizedKey`; **lost-recording test** (skip the client `registerRecording` call → webhook/reconciler still creates a ready row from `fields`); **idempotency test** (replay webhook → no dup/corruption); `getEventBySlug` returns nothing for non-active/non-existent slugs.
> Implement only this stage, then stop.

---

## ▶ STAGE 3 — Host gallery

> Implement Stage 3 of Toastbook (see STANDING CONTEXT). Honor hard rules 3, 4, 7.
> **Objective:** the host sees and manages incoming messages live.
> **Build:** a dashboard event-detail route listing recordings via reactive `useQuery(listByEvent)` (live, no polling). Each row: guest name, duration, status, inline `<audio>` player that uses **`normalizedUrl` only** and shows a distinct "processing…" state otherwise. **action** `deleteRecording({recordingId})`: remove the row AND delete both R2 objects by key (`@aws-sdk/client-s3` `DeleteObjectCommand` against the R2 endpoint, in a `"use node"` action). **mutation/action** `deleteEvent` cascades to recordings + their R2 objects. Empty state; per-row delete with confirm. Style per the design tokens.
> **Acceptance:** new recordings appear live without refresh; deleting a recording removes the row and purges both R2 objects.
> Implement only this stage, then stop.

---

## ▶ STAGE 4 — Host authentication (Clerk)

> Implement Stage 4 of Toastbook (see STANDING CONTEXT). Honor hard rule 2 (guests stay public).
> **Objective:** only the owning host can see/manage their events.
> **[MANUAL]:** Clerk JWT template named `convex`; set issuer in `convex/auth.config.ts`; add Clerk keys to env.
> **Build:** wrap the app in `ClerkProvider` + `ConvexProviderWithClerk` (Clerk `useAuth`); use `clerkMiddleware` for protected routes; lazy `users` upsert on first authenticated mutation (`ctx.auth.getUserIdentity()` → upsert by `clerkId`); gate all host functions (`listByEvent` ownership, `deleteRecording`, `deleteEvent`, event CRUD) on identity → `users` row; **guest functions remain public**; sign-in/up UI; protect the dashboard.
> **Acceptance:** signed-out users can't access the dashboard or call host functions; a host sees only their own events; a different user can't read/mutate another's data; guest recorder still works with no auth.
> Implement only this stage, then stop.

---

## ▶ STAGE 5 — Event creation & sharing

> Implement Stage 5 of Toastbook (see STANDING CONTEXT). Honor hard rules 1, 4.
> **Objective:** a host can create an event and share it.
> **Build:** event-create form (title, couple names, date, optional cover image + optional greeting recording); generate an unguessable `slug` (nanoid). Cover/greeting upload via the same signed-Uppy → Transloadit → R2 path (an image-resize step for the cover, the audio-normalize step for the greeting); store `coverKey`/`greetingKey`. Generate a QR for `https://toastbook.co/e/{slug}` (`qrcode`) — downloadable PNG (screen) + PDF (print). Copyable share link. The recorder page renders cover, names, and plays the greeting. Style per design tokens.
> **[MANUAL]:** ensure the Transloadit credential covers the cover/greeting store steps.
> **Acceptance:** host creates an event, downloads a QR, and `/e/{slug}` reflects the event's branding + greeting.
> Implement only this stage, then stop.

---

## ▶ STAGE 6 — Payment & paywall (Stripe)

> Implement Stage 6 of Toastbook (see STANDING CONTEXT). Honor hard rules 5, 6.
> **Objective:** €49 one-time unlock that gates download/keep, never recording.
> **[MANUAL]:** create the Stripe product/price (€49 one-time); add Stripe keys; register the webhook endpoint at the Convex HTTP action; use `stripe listen --forward-to <convex-http-url>` locally.
> **Build:** **action** `createCheckout({eventId})` → Stripe Checkout session with `metadata:{eventId}` + success/cancel URLs. Convex **HTTP action** webhook: verify signature using the **raw body** (`await request.text()`), read `metadata.eventId`, set `event.isPaid=true`; idempotent on `stripeSessionId`. Gate download-all + permanent gallery/share behind `isPaid`; recording stays free & unlimited. Post-payment confirmation UI.
> **Acceptance:** before payment, download/share locked; after a Stripe **test-mode** payment, `isPaid` flips and unlocks; replaying the webhook does not double-process; recording is unaffected by payment state.
> Implement only this stage, then stop.

---

## ▶ STAGE 7 — Download-all + transactional emails

> Implement Stage 7 of Toastbook (see STANDING CONTEXT).
> **Objective:** host downloads all messages as a zip; key moments trigger emails.
> **[MANUAL]:** verify the sending domain in Resend (SPF/DKIM).
> **Build:** "Download all" → a Transloadit `/file/compress` assembly that imports the event's normalized mp3s from R2 (by key) and zips them to R2; return the (paywalled) download link. Resend via `@convex-dev/resend`: "guestbook is live + your QR" (on event creation), "you have new messages" (digest), "payment confirmed / ready to download".
> **Acceptance:** host downloads a working zip of all normalized mp3s; the three emails send and render correctly.
> Implement only this stage, then stop.

---

## ▶ STAGE 8 — Consent, privacy, erasure & abuse protection

> Implement Stage 8 of Toastbook (see STANDING CONTEXT). Honor hard rules 2, 10.
> **Objective:** GDPR basics + locked-down public endpoints.
> **Build:** a **consent notice** on the recorder before recording, linking a real **privacy policy** page (list subprocessors: Convex, Transloadit, Cloudflare R2, Clerk, Stripe, Resend). **Erasure:** confirm host delete removes R2 objects; add a documented deletion-request route; implement a **retention** policy (purge after a defined window unless retained) instead of "forever". **Rate limiting:** apply `@convex-dev/rate-limiter` to `getGuestAssemblyOptions` and `registerRecording`, keyed per slug; enforce a per-event `guestCap` ceiling (abuse/cost cap, not a paywall). Re-confirm all guest functions validate slug + active and use only server-defined steps.
> **Acceptance:** recording is blocked without an on-screen consent affordance; hammering the guest endpoints gets rate-limited; a deletion removes the row and purges R2.
> Implement only this stage, then stop.

---

## ▶ STAGE 9 — Polish & launch readiness

> Implement Stage 9 of Toastbook (see STANDING CONTEXT).
> **Objective:** production-quality edges.
> **Build:** loading / empty / error / `failed` states everywhere; an assembly-failure retry control on the gallery; a recorder fallback (`RecordRTC` or `extendable-media-recorder`→WAV) if native `MediaRecorder` misbehaves; accessibility pass on the recorder (labels, focus, mic-denied explainer); analytics on the recorder funnel (open → record → send → ready); a final cross-device QA matrix (iOS Safari, Android Chrome, desktop).
> **Acceptance:** a friendly real wedding can use it end to end without intervention; all earlier acceptance tests still pass.
> Implement only this stage, then stop.

---

## Final QA checklist (run after Stage 9)
- Real-device recorder works (iPhone Safari + Android Chrome).
- Lost-recording test passes (webhook/reconciler creates the row without the client call).
- Idempotency holds (replay Transloadit + Stripe webhooks).
- Access control holds (slug validation; host-only data isolation).
- Payment gates download/share only; recording always free.
- Consent + privacy + erasure present; rate limits active.

**Before charging anyone:** run Stages 0–5 at one or two real weddings for free to pressure-test recording reliability. Distribution (SEO + planner/venue partnerships) is a separate workstream and the real risk — validate demand alongside the build.
