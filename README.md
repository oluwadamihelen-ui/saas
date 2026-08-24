# Storyloom

An AI-powered SaaS for turning ideas or scripts into animated videos —
storyboard, consistent characters, scene visuals, narration, music and a
finished export, in one pipeline.

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript), traditional dynamic
  rendering (Cache Components/PPR is not enabled)
- **Database**: PostgreSQL via Prisma ORM 7 (driver adapter: `@prisma/adapter-pg`)
- **Auth**: Auth.js (NextAuth v5), credentials provider, JWT sessions
- **Jobs/queue**: BullMQ + Redis (wired in Phase B for async AI generation)
- **Styling**: Tailwind CSS v4 with an original design token set (see
  `src/app/globals.css`)
- **Video rendering**: Remotion (`@remotion/renderer` + `@remotion/bundler`),
  driven headlessly by a Chrome/Chromium binary
- **Storage**: S3-compatible object storage behind a `StorageProvider`
  abstraction (local-disk implementation for dev)

## Local development

### Prerequisites

- Node.js 22+
- PostgreSQL 16 and Redis running locally (see below)

### Database & Redis

This repo ships a `docker-compose.yml` for Postgres + Redis. If Docker isn't
available in your environment, install them natively instead:

```bash
# Docker (preferred where available)
docker compose up -d postgres redis

# or natively on Debian/Ubuntu
sudo apt-get install -y postgresql redis-server
sudo service postgresql start
sudo service redis-server start
```

Create the app database/role to match `.env.example`:

```sql
CREATE ROLE saas LOGIN PASSWORD 'saas_dev_password' CREATEDB;
CREATE DATABASE saas OWNER saas;
```

### Environment variables

```bash
cp .env.example .env
npx auth secret   # writes a fresh AUTH_SECRET into .env
```

See `.env.example` for the full list — AI/image/video/voice/music providers
default to `mock`, so the app runs completely without external API keys.
`REMOTION_BROWSER_EXECUTABLE` should point at a Chrome/Chromium binary
(Remotion otherwise tries to download its own `chrome-headless-shell`,
which needs network access to Remotion's CDN); `APP_URL` must be reachable
by that browser process so it can fetch scene images/audio from
`public/uploads` while rendering.

### Install & run

```bash
npm install
npx prisma migrate dev   # applies the schema, generates the client
npx prisma db seed       # populates the system voice/music libraries
npm run dev              # web app
npm run worker           # in a second terminal — processes generation jobs
```

Visit http://localhost:3000. The worker must be running for storyboard/scene/
voice generation to complete — without it, generation jobs sit queued in
Redis. The seed step is optional but the Voice/Music library pages and the
per-scene voice picker are empty without it.

## Project structure

```
src/
  app/
    (marketing)/     # public site: landing, features, pricing, faq, contact...
    (auth)/           # login, signup, password reset
    (app)/             # authenticated dashboard (protected by proxy.ts)
    api/                # route handlers
  server/
    auth/              # Auth.js config (edge-safe + full), session helpers
    db/                # Prisma client singleton
    credits/           # credit ledger
    projects/           # auth-scoped repositories
    scenes/              # auth-scoped scene repository (ownership via project)
    characters/           # auth-scoped character repository
    captions/              # auth-scoped caption repository (ownership via scene->project)
    providers/               # AIProvider/ImageProvider/VoiceProvider/MusicProvider + mock/ implementations
    pipeline/                  # generation stages: analyze-script, build-storyboard,
                                #   generate-scene-image, generate-scene-voice,
                                #   generate-captions, render-project
    jobs/                       # BullMQ queues (queue.ts) + worker process (worker.ts)
    storage/                     # StorageProvider (local dev impl; swap in S3/R2 for prod)
    render/                       # auth-scoped RenderJob repository
    billing/                      # Stripe client, checkout/portal session creation
  components/
    ui/                # base design system (Button, Card, Input, Badge...)
    marketing/           # public site sections/forms
    dashboard/            # authenticated app components
      editor/               # the LEFT/CENTER/BOTTOM/RIGHT timeline editor
  lib/                # validation schemas, plans/credit config, utilities
  remotion/           # the video composition Remotion renders server-side:
                       #   entry.tsx (registerRoot), StoryComposition.tsx,
                       #   Scene.tsx (Ken Burns + captions + narration audio),
                       #   BackgroundMusic.tsx (ducking/fade volume automation)
prisma/
  schema.prisma        # full data model
  seed.ts               # system voice presets + music tracks (npx prisma db seed)
docker-compose.yml     # Postgres + Redis for local/dev parity with prod
```

## Auth & authorization

- `src/proxy.ts` (Next.js 16's renamed `middleware.ts`) redirects
  unauthenticated requests away from protected route prefixes.
- Every data-access function in `src/server/*/repository.ts` is scoped by
  `userId` — API routes call `requireUserId()` and never trust a
  client-supplied id without an ownership check in the query itself.
- Passwords are hashed with bcrypt; password reset uses single-use,
  hashed, expiring tokens (`VerificationToken`).

## Credits & plans

`src/lib/plans.ts` defines plan tiers and per-operation credit costs.
Prices are intentionally left undecided (`TBD` on the pricing page) until
business decisions are made — the dollar amount lives entirely in your own
Stripe Price objects, never in this codebase. All balance changes go
through `applyCreditDelta` in `src/server/credits/ledger.ts`, which writes
an auditable `CreditLedgerEntry` for every grant and charge.

## Billing (Stripe, preview-mode-first)

Like the AI providers, billing runs in a clearly-labeled preview mode
until configured: `isStripeConfigured()` (`src/server/billing/stripe.ts`)
just checks whether `STRIPE_SECRET_KEY` is set. Without it, `/billing`
shows a "Billing preview mode" notice and every upgrade/purchase button is
replaced with a "Preview mode" label instead of attempting a real
checkout — the plan grid, credit balance, and credit history are all still
fully real and functional.

To go live: create Products/Prices for Starter/Creator/Pro and the two
credit packs in your Stripe dashboard, paste the resulting `price_...` IDs
into `STRIPE_PRICE_*` in `.env`, and set `STRIPE_SECRET_KEY` +
`STRIPE_WEBHOOK_SECRET` (point a Stripe webhook at
`/api/webhooks/stripe`, subscribed to `checkout.session.completed`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.payment_succeeded`, and `invoice.payment_failed`).
`src/server/billing/checkout.ts` creates subscription checkout sessions,
one-time credit-pack checkout sessions, and Stripe Billing Portal sessions
(lazily creating a Stripe Customer on first use, stored on `Subscription`).
The webhook handler grants the plan's `monthlyCredits` both on initial
subscribe and on every `subscription_cycle` renewal invoice, records
one-time purchases with the `PURCHASE` ledger reason, and keeps
`Subscription.status`/`plan` in sync with Stripe (including mapping a
canceled subscription back down to `FREE`).

Verified without needing a real Stripe account: used the `stripe` SDK's own
`webhooks.generateTestHeaderString` (a local HMAC operation, no network
call) to send correctly-signed test events for the full subscription
lifecycle — checkout → credit-pack purchase → renewal → payment failure →
recovery → cancellation — against the real running webhook route, and
confirmed both the `Subscription` row and every `CreditLedgerEntry` ended
up in exactly the expected state at each step. Also confirmed a
tampered/invalid signature is rejected with 400. Real end-to-end checkout
(the parts that need Stripe's own servers — hosted Checkout pages, the
Billing Portal UI) needs your own Stripe test API keys to exercise.

## AI providers (mock-first)

`AI_PROVIDER` / `IMAGE_PROVIDER` / `VOICE_PROVIDER` / `MUSIC_PROVIDER` in
`.env` default to `mock`, resolved via the factories in
`src/server/providers/index.ts`. `MockAIProvider` is a deterministic,
rule-based storyboard/character generator (sentence splitting + heuristics —
not a real LLM); `MockImageProvider` renders an SVG "scene card" placeholder;
`MockVoiceProvider`/`MockMusicProvider` synthesize real, valid, audible WAV
files (`src/server/providers/mock/wav.ts`) — short tone sequences that track
narration word count and speed, and mood-colored chords for music — rather
than pretending to be real speech or a real composition. Every provider sets
`isMock: true`. To add a real adapter, implement the corresponding interface
in `src/server/providers/types.ts` and add a case to the relevant factory
function — nothing else in the app depends on which implementation is active.

## Generation pipeline & jobs

`POST /api/projects/:id/generate` enqueues a `project-generate` BullMQ job.
The worker (`npm run worker`) runs `runScriptAnalysis` → `runBuildStoryboard`
(creates/reuses `Character` rows by name and creates `Scene` rows), then fans
out one `scene-image` job per scene. `POST /api/scenes/:id/generate-voice`
enqueues a `scene-voice` job that synthesizes narration and then
auto-generates timed captions from it (`runGenerateCaptions`, a proportional
word-count heuristic — not audio-aligned transcription). Every stage writes
a `GenerationJob` row (`queued|processing|completed|failed`) and debits
credits via the ledger before calling the provider — insufficient credits
fails the job cleanly rather than running for free. The project detail page
polls `GET /api/projects/:id/jobs` while generating and stops once scenes
settle. A single scene's image or voice can be regenerated independently
without rerunning the whole pipeline.

## The editor (`/projects/:id/edit`)

A beginner-friendly (not professional-NLE-complexity) LEFT/CENTER/BOTTOM/
RIGHT editor: a scene list, a preview that plays each scene's narration
audio (or a timer, if a scene has none) and auto-advances with burnt-in
caption overlays, a proportional-width timeline scrubber, and a right panel
that toggles between per-scene voice settings (preset/speed/pitch + a
captions list editor) and project-level background music (pick a track,
set volume/fade/loop, with duck-under-narration applied live via JS volume
ducking during playback — see `src/components/dashboard/editor/`).

## Rendering & export (`/projects/:id/export`)

`POST /api/projects/:id/render` creates a `RenderJob` and enqueues a
`project-render` BullMQ job (kept at worker concurrency 1 — it drives a
headless Chrome instance and shouldn't run several at once per process).
`runRenderProject` (`src/server/pipeline/render-project.ts`) bundles
`src/remotion/entry.tsx` once per worker process lifetime (cached), builds
`RenderInputProps` from the project's scenes/captions/music (converting
`public/uploads` paths to absolute URLs via `APP_URL` so the headless
browser can fetch them), then calls Remotion's `renderMedia`. Progress
updates from Remotion's single 0..1 callback are bucketed into the stage
labels a user actually cares about — Preparing render → Rendering scenes →
Mixing audio → Encoding video → Finalizing — written to `RenderJob.progress`/
`stage` for the export page to poll. The finished MP4 is uploaded through
`StorageProvider` and set as `Project.finalVideoUrl`; the export page then
shows a real `<video>` preview, a download link, a copy-link share action,
and a way to render another version. Verified end-to-end: a real 3-scene
project rendered to a structurally valid MP4 (parsed its `moov`/`mvhd`/`tkhd`
boxes directly) with the correct 1280×720 dimensions, a duration matching
the summed scene timings, and both a video and an audio track muxed
together.

## What's implemented vs. what's next

**Phase A — Foundation**: architecture, Postgres schema, Auth.js, protected
dashboard shell, project CRUD, billing/credit ledger UI, original marketing
site.

**Phase B — AI workflow**: mock `AIProvider`/`ImageProvider`, BullMQ job
queue + worker, script analysis → storyboard → character extraction/reuse →
scene image generation pipeline, full scene CRUD (edit, duplicate, delete,
reorder, regenerate, add), and a full character library (create/edit/delete,
generate a mock portrait, or upload your own reference image).

**Phase C — Creator experience**: mock `VoiceProvider`/`MusicProvider`, a
seeded system voice library (14 voices across 7 styles) and music library
(9 moods), per-scene voice generation with adjustable speed/pitch,
auto-generated + manually editable captions, project-level background music
with volume/fade/loop/duck settings, and the timeline editor.

**Phase D — Rendering**: real Remotion-based video composition and MP4
export, described above.

**Phase E (this phase) — Monetization**: real Stripe subscription checkout,
one-time credit-pack purchases, the Billing Portal, and webhook-driven
credit grants/renewals — all running in an honest preview mode until Stripe
keys are configured, described above.

**Not yet built**: production hardening (Phase F — broader automated test
coverage, structured logging, rate-limit tuning beyond the current
in-memory per-route limiter, a security pass). Nothing in this codebase
fakes AI output, a fake render, or a fake payment — every generated asset
(images, storyboards, narration audio, music, the final composited video)
is real mock-provider/Remotion output produced end-to-end, and billing
either talks to the real Stripe API or plainly says it's in preview mode.
