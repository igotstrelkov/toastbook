# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Operating instructions for coding agents in this repo. **Read this every run.** Full context lives in `/docs/spec.md` (PRD), `/docs/implementation-plan.md` (staged build order), and `/docs/stages-1-2.md` (detailed contracts). Keep THIS file as the rules; those as the reference.

**Product:** Toastbook — an audio guestbook for weddings. A host creates an event, shares a QR/link, guests record a voice message in the browser (no app), each is normalized to mp3 and stored, and the host gets a private gallery to play, delete, and download. €49 one-time unlock per event. Scope = Digital tier MVP only.

---

## Hard rules — never violate

1. **Never expose secrets to the client.** Transloadit assembly options are signed in a Convex **action**; the client never sees `TRANSLOADIT_SECRET` or any secret.
2. **Guests are NOT authenticated.** Guest-callable functions are public but MUST (a) validate the event `slug` and that the event is `active`, (b) invoke only **server-defined** Transloadit steps — never client-supplied steps, (c) be rate-limited.
3. **The audio player plays `normalizedUrl` (mp3) ONLY.** While `status === "processing"`, show a processing state. NEVER play `originalUrl` — it may be `webm` and will not play on iOS/Safari.
4. **Audio files live in R2 (via Transloadit), referenced by object KEY.** Convex stores metadata/keys only — never audio bytes, never static public URLs. Derive URLs from `${MEDIA_BASE_URL}/${key}` on read.
5. **All webhooks are idempotent.** Match Transloadit by `assemblyId`, Stripe by `stripeSessionId`. Ignore duplicates and out-of-order deliveries.
6. **Payment gates download/keep — NEVER recording.** Guests always record freely and without limit.
7. **Keep originals.** Deletion removes the Convex row AND both R2 objects (by key).
8. **The webhook is the source of truth for recordings.** Upsert the `recordings` row by `assemblyId` using the assembly `fields: { eventId, guestName }`. The client's `registerRecording` is optimistic only and may never fire (tab closed) — the webhook/reconciler must still create the row.
9. **Duration comes from a client-side timer**, never from the `MediaRecorder` blob (webm blobs report `Infinity`/`NaN`).
10. **GDPR:** a consent notice shows before recording; a deletion/erasure path must exist. No privacy policy → take no real recordings.

---

## Stack

Next.js (App Router, TypeScript) · Convex (DB, server functions, realtime, HTTP webhooks) · Clerk (host auth only — **email magic link / passwordless**) · Transloadit via `@transloadit/convex` (upload + loudnorm→mp3, output to R2) · Cloudflare R2 (media storage, public bucket on a custom domain) · Stripe (one-time payment) · Resend via `@convex-dev/resend` (email) · `@convex-dev/rate-limiter`. **No Inngest in the MVP.**

## Architecture (one paragraph)

Browser records via `MediaRecorder` → Uppy + tus uploads **directly to Transloadit** using server-signed options → Transloadit runs `loudnorm`→mp3 and stores original + normalized to **R2** under unguessable keys → Transloadit webhook hits a Convex **HTTP action** (component verifies signature) → a finalize step upserts the `recordings` row by `assemblyId`. Convex holds metadata; R2 holds files; the player reads the normalized mp3 via `MEDIA_BASE_URL/key`.

## Conventions

- TypeScript everywhere; Convex `v.*` validators on every function argument.
- **Function types:** `query` = reactive reads (no external fetch); `mutation` = writes (no external fetch); `action` = secrets / external services / node-only SDKs (use `"use node"` for `@aws-sdk/client-s3`, etc.).
- Reads derive media URLs from stored keys — do not store URLs.
- `registerRecording` and `finalizeRecording` are both keyed on `assemblyId` so they converge regardless of order.
- Secrets only in Convex env / `.env.local`; never commit secrets.

## Commands

- `npx convex dev` — run Convex. Note: HTTP actions get a **public URL even in dev**, so Transloadit/Stripe webhooks work without a tunnel.
- `next dev` — run the web app.
- `npx convex env set NAME value` — set a Convex env var.
- `stripe listen --forward-to <convex-http-url>` — test Stripe webhooks locally.

## Env vars (names only — never commit values)

- **Client:** `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- **Convex:** `TRANSLOADIT_KEY`, `TRANSLOADIT_SECRET`, `MEDIA_BASE_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `CLERK_SECRET_KEY` (+ Clerk JWT issuer in `convex/auth.config.ts`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`

## Verify — do NOT trust training data

- **`@transloadit/convex` is pre-1.0.** Confirm against the current README: exports (`makeTransloaditAPI` → `createAssemblyOptions`, `queueWebhook`, `listResults`; `handleWebhookRequest`), the `createAssemblyOptions({ steps, fields })` shape, and the `listResults` row shape (where the stored object key lives). Adjust if the API differs.
- **Transloadit robots evolve.** Verified in build: store to R2 with **`/cloudflare/store`** (R2-native) + a **Cloudflare** Template Credential named `toastbook` — NOT `/s3/store`, which forces an AWS region R2 rejects. `/audio/encode` `ffmpeg.af` loudnorm + `ffmpeg_stack: v6.0.0` and `path` vars (`${fields.*}`, `${assembly.id}`, `${file.ext}`) confirmed working. Note `/cloudflare/store` prepends the bucket name to the key.
- **Other SDKs:** use `clerkMiddleware` (not the deprecated `authMiddleware`); Stripe signature verification needs the **raw request body** (`await request.text()`), not parsed JSON. Confirm current Clerk/Convex/Stripe APIs.
- **Always build the cron reconciler** that finalizes/fails `processing` rows older than ~30s via `listResults`/`getAssemblyStatus`, as a safety net regardless of the webhook hook.

## Tests that must pass (do not skip)

- **Real-device recorder:** on a real iPhone (Safari) and Android (Chrome), record → send → the normalized mp3 plays back. This is the project's riskiest checkpoint.
- **Lost-recording:** skip the client `registerRecording` call — the webhook/reconciler must still create a `ready` row from `fields`. No recording is lost.
- **Idempotency:** replaying Transloadit and Stripe webhooks does not duplicate or corrupt rows.
- **Access control:** `getEventBySlug` returns nothing for non-active/non-existent slugs; host functions reject unauthenticated or non-owner callers.

### Styling

Tailwind CSS v4 is used. Tailwind is configured entirely through `app/globals.css` (no `tailwind.config.*` file). Design tokens (colors, radius, fonts) are defined as CSS custom properties in that file and exposed to Tailwind via `@theme inline`. The dark-mode variant is `class`-based (`.dark` class on `<html>`).

### shadcn/ui

Components live in `components/ui/`. Add new ones with:

```bash
npx shadcn@latest add <component-name>
```

The style is `radix-nova`. All aliases resolve through `@/` (e.g. `@/components/ui/button`, `@/lib/utils`, `@/hooks`).

### Theme system

`components/theme-provider.tsx` wraps `next-themes` and forces the light theme app-wide via `forcedTheme="light"` (with `enableSystem={false}`), so the OS preference and any saved `localStorage` value are ignored. It is mounted at the root in `app/layout.tsx`. Dark mode is intentionally disabled — there is no theme toggle.

### Utility

`lib/utils.ts` exports `cn()` — a `clsx` + `tailwind-merge` helper. Use it for all conditional class merging; Prettier is configured to sort Tailwind classes in `cn()` and `cva()` calls automatically.

### Fonts

Four Google Fonts are loaded in `app/layout.tsx`, each exposed as a CSS variable:

- `Inter` → `--font-sans` (sans-serif body)
- `Newsreader` → `--font-newsreader` (serif display, used for headings)
- `Hanken_Grotesk` → `--font-hanken` (UI labels/eyebrows)
- `Space_Mono` → `--font-space-mono` (monospace accents)

Geist (the display font from the original shadcn setup) is not used.

### Path aliases

`@/*` maps to the repo root. There is no `src/` directory.
