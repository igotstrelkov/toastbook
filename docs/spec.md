# Wedding Audio Guestbook — Digital Tier MVP Spec (v2, post-audit)

A build spec for a solo web developer, on a **Convex + Clerk + Transloadit + Resend** stack (Inngest deferred to the Keepsake tier). Scope is the **Digital tier** ($49): recording, a clean auto-normalized gallery, download, and payment.

> **v2 changelog (audit fixes):** corrected the Transloadit flow to match the real `@transloadit/convex` component (browser → Transloadit → R2, results referenced in Convex — no Convex-storage round-trip); replaced hand-rolled upload retries with Uppy + tus; secured guest uploads via a server-side Template + slug validation + rate limiting; fixed the cross-device playback gap; added host **delete**, a **privacy/consent/erasure** section, a **cost model**, and a **non-engineering prerequisites** section.

---

## 1. Scope

**The core loop:** a host creates an event → shares a QR code / link → guests open it on their phones and record an audio message in the browser (no app) → Transloadit normalizes each message and stores it → the host gets a private gallery to play, delete, and download.

**In scope for MVP:**
- Host sign-up + event creation
- Public guest recorder page (no guest login)
- In-browser audio recording (`MediaRecorder`) + resumable upload (Uppy + tus → Transloadit)
- Automatic loudness normalization + transcode-to-mp3 of every message (Transloadit)
- Host gallery: list, play, **delete**, download
- Guest **consent notice** + a deletion/erasure path (GDPR)
- One-time $49 unlock via Stripe
- QR code + shareable link generation

**Out of scope (later tiers):** highlight reel, AI transcripts, video/photo contributions, physical keepsakes, lifetime archive.

---

## 2. Stack & service responsibilities

| Service | Owns | Notes |
|---|---|---|
| Convex | Database, server functions (actions/queries/mutations), realtime, Stripe + Transloadit webhooks, rate limiting | Backbone. Reactive queries = live dashboard. Holds **structured data and result references only** — not the audio files. |
| Transloadit + R2 | All media: upload, normalization, storage | Browser uploads via Uppy directly to Transloadit; the `/audio/encode` robot runs `loudnorm` and transcodes to mp3; output is stored in **Cloudflare R2**. The `@transloadit/convex` component signs options server-side, verifies webhooks, and persists result references in Convex. |
| Clerk | Host authentication | Hosts only — guests never authenticate (see §4 for how guest uploads stay secure without auth). |
| Resend | Product emails | "Guestbook live + QR", "new messages", "payment confirmed". Use the official `@convex-dev/resend` component. |
| Inngest | (Deferred) | Not used at MVP — Transloadit's async assembly + webhook is the orchestration. Returns for the Keepsake reel. |

Frontend: **Next.js (React)**, `ClerkProvider` + `ConvexProviderWithClerk`. **Stripe** for the one-time payment.

### Component wiring (verified against the real package)

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import transloadit from "@transloadit/convex/convex.config";
const app = defineApp();
app.use(transloadit);
export default app;

// convex/transloadit.ts
import { makeTransloaditAPI } from "@transloadit/convex";
import { components } from "./_generated/api";
export const { createAssemblyOptions, queueWebhook, listResults } =
  makeTransloaditAPI(components.transloadit);

// convex/http.ts  — webhook route (signature verified by the component)
import { httpRouter } from "convex/server";
import { handleWebhookRequest } from "@transloadit/convex";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
const http = httpRouter();
http.route({
  path: "/transloadit/webhook",
  method: "POST",
  handler: httpAction((ctx, request) =>
    handleWebhookRequest(request, {
      mode: "queue",
      runAction: (args) => ctx.runAction(api.transloadit.queueWebhook, args),
    }),
  ),
});
export default http;
```

Env: `npx convex env set TRANSLOADIT_KEY <key>` and `TRANSLOADIT_SECRET <secret>`.

### Normalization pipeline

```
guest taps "Send"
  → client requests SIGNED assembly options from a Convex action
      (action validates slug + active + rate limit, then delegates to
       createAssemblyOptions with a fixed server-side TEMPLATE and
       fields: { eventId, guestName })
  → Uppy (@uppy/transloadit, tus) uploads the blob directly to Transloadit
  → on Uppy "assembly created", client calls mutation registerRecording(
       { slug, assemblyId, guestName, durationSeconds }) → row status "processing"
  → Transloadit runs the template: /audio/encode loudnorm → mp3, stores to R2
  → Transloadit webhook → component persists results → queueWebhook follow-up
       matches assemblyId, sets normalizedUrl + originalUrl, status "ready"
  → reactive gallery query flips the row to ready
```

Why this shape: the client never holds your Transloadit secret (options are signed server-side), and because the client can only invoke a **fixed Template** — not arbitrary steps — a leaked link can at worst upload-and-normalize audio, never run arbitrary jobs on your account.

---

## 3. Data model (Convex schema)

Convex holds structured data; **audio files live in R2** (via Transloadit), referenced by URL. The component maintains its own `assemblies`/`results` tables; `recordings` below is the app-level view that links results to events.

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
  }).index("by_clerk_id", ["clerkId"]),

  events: defineTable({
    userId: v.id("users"),
    title: v.string(),
    eventDate: v.string(),
    coverUrl: v.optional(v.string()),       // image stored in R2 via Transloadit
    greetingUrl: v.optional(v.string()),    // normalized greeting in R2
    slug: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("closed")),
    isPaid: v.boolean(),
    stripeSessionId: v.optional(v.string()),
    guestCap: v.optional(v.number()),        // abuse/cost ceiling, not a paywall
  })
    .index("by_user", ["userId"])
    .index("by_slug", ["slug"]),

  recordings: defineTable({
    eventId: v.id("events"),
    assemblyId: v.string(),                  // links to Transloadit result; idempotency key
    guestName: v.optional(v.string()),
    originalUrl: v.optional(v.string()),     // R2
    normalizedUrl: v.optional(v.string()),   // R2, mp3 — the only thing the player uses
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

Notes:
- `normalizedUrl` (mp3) is what the gallery plays — universal across devices. `originalUrl` is kept for safety/download only and is **never** used by the in-app player (see §7, playback).
- Match webhooks to rows by `assemblyId`; ignore a completion for a row already `ready` (idempotent).

---

## 4. Guest recording flow

No login. Security comes from slug validation + a fixed Template + rate limiting, not auth.

1. Guest opens `/e/{slug}` — plain mobile web page.
2. Public query `getEventBySlug({ slug })` returns display info, validating the event is `active`; never exposes other events.
3. Page shows names + cover + prompt, plays the greeting, and shows a **consent line**: "By recording, your message and voice will be saved and shared with the host. See our privacy policy." (§7).
4. Tap **Record** → `getUserMedia({ audio: true })` on the tap gesture. Pick a capture format with `MediaRecorder.isTypeSupported()` (Safari → `audio/mp4`, Chrome/Android → `audio/webm`); store none of this assumption-hardcoded. Timer, level meter, 60s cap.
5. **Stop** → playback preview, **Keep** / **Re-record**, optional name.
6. **Send:** client gets signed assembly options from the Convex action (validated + rate-limited), Uppy uploads the blob to Transloadit over tus (resumable — survives flaky venue wifi), then `registerRecording` creates the `processing` row.
7. Thank-you screen, "record another".

**Recorder reliability (the top technical risk — prototype this first):**
- Capture format doesn't need to be universal because Transloadit transcodes to mp3 server-side; FFmpeg decodes both `webm/opus` and `mp4/aac` fine. Capture in whatever the device supports, normalize on the server.
- Feature-detect with `isTypeSupported`; handle permission denial with a clear "enable mic" explainer.
- Rely on Uppy + tus for resumability rather than hand-rolled retries.
- Keep a `RecordRTC` (or `extendable-media-recorder` → WAV) fallback ready in case native `MediaRecorder` misbehaves on a target device.
- **Test on real iPhones and Androids before building anything else.**

---

## 5. Host flow

1. Sign in with Clerk via **email magic link** (passwordless — Clerk emails a sign-in link; this is the chosen host auth method, configured in the Clerk dashboard).
2. Create an event (title, names, date, optional cover image + greeting). Cover/greeting upload via the same signed-Uppy → Transloadit → R2 path (image resize / audio normalize templates).
3. Get a shareable link + downloadable **QR code** (`qrcode` package).
4. Dashboard lists recordings via reactive `useQuery` — live, no polling. Each row: name, duration, status, inline player (plays `normalizedUrl` only when `ready`), and a **delete** control.
5. **Delete:** `deleteRecording` removes the row and deletes the R2 objects (original + normalized). Deleting an event cascades to its recordings and files.
6. Unlock unlimited collection + download-all via **Stripe Checkout** — create the session with `metadata: { eventId }`. Stripe webhook → Convex **HTTP action** verifies the signature, reads `eventId`, sets `isPaid = true` (idempotent on `stripeSessionId`). Resend confirms.
7. **Download all:** a Transloadit `/file/compress` assembly zips the event's mp3s to R2; host downloads the link. Share a read-only gallery link as an alternative.

**Auth wiring:** Clerk JWT template named `convex`; issuer in `convex/auth.config.ts`; host functions check `ctx.auth.getUserIdentity()` and map `subject` → `users`. Guest functions skip this.

---

## 6. The free → paid trigger

**Gate the download/keep, never the recording.** Guests record without limit during the event (participation *is* the value); the host pays $49 to **download / permanently keep** the gallery afterward. `guestCap` exists only as an abuse/cost ceiling, not a paywall. Start here; a free preview cap is the riskier alternative.

---

## 7. Privacy, consent & data protection (GDPR — you are in the EU)

You record and store people's voices: personal data, and you're in Ireland, so GDPR applies. Minimum bar for launch:
- **Consent notice** on the recorder before recording (§4 step 3), with a lawful-basis-appropriate wording and a link to a real **privacy policy**.
- **Erasure path:** host `deleteRecording`/event deletion (§5) plus a documented route for a guest or host to request deletion. Honor it by removing the row and the R2 objects.
- **Retention:** define a window (e.g. files retained through the access period + a stated retention, then purged) rather than literally "forever." Keep originals only as long as the policy states.
- **Subprocessors:** Convex, Transloadit, Cloudflare R2, Clerk, Stripe, Resend all process personal data — list them in the privacy policy and confirm each offers a DPA. Prefer EU/EEA storage regions where the providers allow (e.g. R2 region, Transloadit region).

---

## 8. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| Cross-device recording is the top technical risk | Capture format is non-interoperable (Safari `mp4/aac` vs Chrome/Android `webm/opus`); feature-detect and let Transloadit normalize to mp3. Prototype on real devices first; keep a recorder fallback. |
| Playback gap | A raw `webm` original will not play in Safari/iOS. The in-app player uses **`normalizedUrl` (mp3) only**; while `processing`, show a status indicator — never attempt to play `originalUrl`. |
| Public endpoint abuse / cost | The signed-options action validates slug + `active`, exposes only a **fixed Template**, and is rate-limited (`@convex-dev/rate-limiter`, keyed per slug) with a per-event `guestCap` ceiling. |
| Webhook integrity & idempotency | The component verifies the Transloadit signature; match results by `assemblyId` and ignore completions for rows already `ready`. Same idempotency on the Stripe webhook (`stripeSessionId`). |
| Data loss | Don't mark a recording `ready` until the webhook confirms stored R2 URLs; keep `originalUrl` as a backup. |
| Third-party dependency / vendor concentration | Managed costs and availability sit with the vendors; Convex is a single backbone SPOF — acceptable for MVP, revisit if it bites. |
| Storage cost at scale | R2 storage is cheap with zero egress; audio is small. Fine for MVP. |
| Email deliverability | Verify the sending domain (SPF/DKIM) in Resend. |

---

## 9. Suggested build order

1. **Recorder prototype first.** Bare `/e/{slug}` page that records via `MediaRecorder` and uploads through Uppy + tus to Transloadit; confirm normalization to mp3 works. Test on real iPhones/Androids before anything else.
2. Convex project + schema + the component wiring (§2). Public `getEventBySlug`, the signed-options action (with slug validation + rate limit + fixed Template), `registerRecording`, and the `queueWebhook` follow-up that finalizes rows.
3. Host dashboard: reactive `listByEvent`, inline player (`normalizedUrl` only), **delete**.
4. Clerk auth (host) + lazy `users` upsert.
5. Stripe Checkout (`metadata.eventId`) + webhook HTTP action + the download paywall (§6).
6. Download-all via `/file/compress`; QR, cover, greeting; Resend emails (verify domain).
7. Consent notice + privacy policy + erasure handling (§7).
8. Polish: rate-limit tuning, failure/empty states, assembly-failure retry.

Ship 1–3 to a couple of friendly real weddings for free to pressure-test recording reliability before turning on payment.

---

## 10. Non-engineering prerequisites (do not skip)

- **Distribution plan.** With no viral loop, acquisition is the make-or-break risk — bigger than anything in this spec. Decide the channel (SEO on "wedding audio guestbook"-type intent, wedding-planner/venue partnerships, paid social) before over-investing in build.
- **Pricing reality check.** $49 anchors against $150–600 physical phone rentals, but a digital competitor (VoiceHug) sits at ~$9.99 — be deliberate about why you're worth 5x it (keepsake quality, the later reel, ease).
- **Legal pages.** Privacy policy + terms, given §7.

---

## 11. Cost model (per $49 event, rough)

- Stripe: 2.9% + $0.30 ≈ **$1.72**.
- Transloadit: GB-priced; ~125 short clips ≈ a few hundred MB processed ≈ **cents**.
- R2: storage ~$0.015/GB-month, **zero egress** ≈ **cents**.
- Clerk: only hosts authenticate (guests aren't users) → effectively **$0** within the free MAU tier.
- Resend: within free/cheap tier → **~$0**.
- Convex: free tier covers MVP volume.

Gross margin per event is roughly **$45+**. Conclusion: unit economics are not the constraint — **volume and distribution are** (see §10). For a revenue-per-user goal, this confirms effort belongs in acquisition and the upsell tiers, not cost-cutting.

---

## 12. What this sets you up for

The engine is "collect + normalize media against an event via an unguessable slug," so higher tiers bolt on:
- **Keepsake** = the highlight reel (host-curated selection + licensed music bed + shareable MP4), assembled by Transloadit and orchestrated by **Inngest** for the multi-step flow; plus AI transcripts, optional video/photo messages, lifetime archive. The reel reintroduces a **music-licensing requirement** (ship a royalty-free track library).
- **Heirloom** = print-on-demand / USB / vinyl fulfilment.
- **Audio → video mode** reuses the same upload, Transloadit processing, and gallery; only the template changes.

### Render vendor decision (revisit at the Keepsake tier — not now)

**Default: Transloadit for everything, including the reel.** Stay single-vendor unless the reel specifically earns a second one. Don't pre-commit Rendi for a feature that doesn't exist yet.

- **Why Transloadit is the default everywhere:** the `@transloadit/convex` component already gives you signed uploads, resumable tus, verified webhooks, and result persistence; it also does concatenation, audio mixing, and waveform generation, and exposes raw `ffmpeg` params. Running a second media vendor means a second integration, billing, credentials, failure modes, and place media lives — real overhead for a solo dev, justified only by a concrete need.
- **The specific test that would move *only the reel* to Rendi:** when you build the reel, prototype it on Transloadit first. The reel is one gnarly pass — concatenate clips with crossfades + duck a music bed (sidechain compression) + overlay an animated waveform on a cover image. If expressing that multi-filter graph across Transloadit's step/robot model gets painful, that awkwardness is the trigger: move *that single render* to Rendi, where one raw FFmpeg command is cleaner. Keep Transloadit for upload, normalization, storage, webhooks, and the zip regardless.
- **Concurrency caveat (applies to either vendor):** a wedding's failure mode is 100+ guests recording inside a one-hour window — a burst of simultaneous assemblies. Confirm your Transloadit plan's concurrency headroom for the event-day spike; Rendi markets warm auto-scaling for exactly this if it ever becomes the bottleneck.
- **Lock-in risk is low:** the component is a convenience layer over Transloadit's stable core API, and the `@transloadit/convex` package is pre-1.0 — if it churns, you can call the core API directly. Nothing here commits you irreversibly.
