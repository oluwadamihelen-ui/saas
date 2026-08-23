# Cinerra

**Turn an idea or screenplay into a cinematic AI movie.**

Cinerra is a production-grade foundation for an AI filmmaking platform: idea → story bible → screenplay → characters/locations/wardrobe/props → scenes → shots → AI video → audio → timeline → episode → movie. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design and rationale.

## What's implemented vs. scaffolded

This build follows the phased plan in the product spec and keeps the project runnable at every stage (never a fake demo):

**Fully working, end-to-end, against a real LLM provider:**
- Auth (email/password + optional Google OAuth), subscriptions data model, fair-use enforcement (no customer-facing credits)
- Project creation → **Inspiration Mode story generation** (Story Architect agent → Story Bible + episode structure)
- **Screenplay generation** (Screenwriter agent → per-episode scene breakdown + script text)
- **Character Bible generation** (Character Designer agent → physical/personality/voice description + default wardrobe per character, reading the screenplay you've already written — never inventing characters that aren't in it)
- **Location Bible generation** (Location Designer agent → architecture/lighting/palette per distinct location, merging scene headings that describe the same physical place)
- **Prop Bible generation** (spec §16: Prop Designer agent → reads the screenplay for significant, plot-relevant, or visually recurring props — never invents one, and skips incidental background objects the story never calls attention to; attributes ownership to a character when the text makes that clear)
- **Continuity linking**: once characters/locations exist, scenes are automatically reconciled to real Character/Location records (`packages/domain/src/services/continuityLinking.ts`) — relational `SceneCharacter` links and `Scene.locationId`, not just text
- **Storyboard generation** (Director agent → breaks every scene into cinematic shot coverage: shot type, camera movement, lens, action, dialogue, duration — standard film grammar, 3-8 shots per scene). The Director is also given the project's known prop list and may only reference real ones per shot (never invents a prop); matched mentions create the relational `ScenePropLink`/`ShotProp` rows the continuity engine and prompt compiler already read from
- **Locking**: characters, locations, wardrobe, and props can all be locked from the UI; a locked entity is never silently rewritten by a regeneration (spec §13-14, §16, §58)
- **Reference image generation** for characters, locations, wardrobe, and props via `ImageProvider` (OpenAI), displayed inline via signed storage URLs (spec §23, §40) — generation is refused once an entity is locked, so an approved identity can't be silently replaced. Character/location references go through a separate Approve step (multiple candidates, one primary); wardrobe/prop each have a single reference slot, so regenerating one directly replaces it once unlocked
- **Shot/video generation** — the full pipeline: `continuityEngine` resolves the character/wardrobe/location/prop/previous-shot graph for a shot → `promptCompiler` compiles the structured, continuity-constrained prompt → `VideoProvider` (Runway) generates the shot using the character's approved reference image for identity consistency → the result is downloaded and persisted to durable storage → an automated QC pass reviews it (see below) → the shot is marked ready with an inline video preview on its storyboard card (spec §20-24)
- **Automated QC pass** (spec §27): at the `VALIDATING` step, a few representative frames are sampled from the freshly generated shot (`packages/media`'s `extractFrame`, real ffmpeg — not a stub) and sent to a vision-capable model (`IMAGE_ANALYSIS` → OpenAI) with the same artifact checklist the prompt compiler already asks the video model to avoid (distorted anatomy, a synthetic/plastic look, watermarks, etc). A frame that fails marks the shot `NEEDS_REVISION` with the specific issues surfaced on its storyboard card instead of the fake "Generated" state; `qualityScore` (0-1, fraction of frames that passed) is shown next to every QC'd shot's status. QC is a signal layered on top of a successful generation, never a gate: if `IMAGE_ANALYSIS` isn't configured, or the pass itself fails for an infrastructure reason, the shot still completes and is marked `READY` exactly as before this phase — only a QC pass that actually ran and found a problem changes the outcome.
- **Job state machine is now actually enforced**, not just defined: every service transitions status through a shared `transitionGenerationJob` helper that validates the move, a BullMQ retry after a failure correctly re-enters via `FAILED → RETRYING → PROCESSING` instead of crashing on an invalid transition, and cancelling a queued job is honored cooperatively before any provider call is made (`packages/domain/src/services/jobTransitions.ts`)
- **True mid-flight cancellation** (spec §24, §57): clicking Cancel while a shot's video is actively generating — Runway's async task can take minutes — doesn't just mark the job cancelled and let it keep running in the background. A background poll in `shotGenerationService` watches for the cancellation write and aborts the in-flight request the moment it appears, calling Runway's own `DELETE /tasks/{id}` endpoint so generation actually stops (and stops billing) server-side, not just locally — Runway's own docs are explicit that a client-side abort/timeout alone does not do this. The Cancel button lives on the same progress card every generation already shows (`GenerationProgress.tsx`), which also now renders a distinct "Cancelled" state instead of looking stuck.
- **Dialogue audio generation** (spec §28): synthesizes a shot's spoken dialogue in the speaking character's voice via `VoiceProvider` (ElevenLabs). A character's voice identity is assigned once (from a small default pool, split by gender) and reused on every regeneration so it doesn't drift; the audio plays inline on the shot card
- **Episode export/assembly** (spec §41-44): once every shot in an episode is ready, "Export Episode" downloads each shot's video plus its dialogue and/or sound-effect audio (mixed together if both exist, or synthesized as silence if neither does) from durable storage, muxes that onto the shot's video, and concatenates the whole episode with real FFmpeg (`packages/media` — a from-scratch wrapper, no fake progress or placeholder file), scaling/padding to the requested resolution and the project's aspect ratio. If the episode has a generated score, it's downloaded and looped/mixed under the assembled audio at reduced volume so dialogue stays intelligible. The final MP4 is then uploaded back to storage with a signed download link. Fails honestly with `FfmpegNotAvailableError` if FFmpeg isn't installed on the worker, rather than pretending to succeed.
- **Trailer and social clip generation**: "Generate Trailer"/"Generate Social Clip" on an episode with a script produce a short, deterministic highlight cut — one representative shot per scene, in story order, included until a target length is reached (60s for a trailer at the project's own aspect ratio; 20s for a social clip, forced to `PORTRAIT_9_16`). This is a plain deterministic selection (`packages/domain/src/lib/clipSelection.ts`), never an "AI picked the best moments" claim. Only requires the specific shots it will actually use to be ready, not the whole episode, so a trailer can be generated as a preview while the rest of the episode is still in progress — reuses the same FFmpeg mux/mix/concat/score-overlay pipeline as full episode export (`packages/domain/src/services/shotAssembly.ts`, shared by both).
- **Sound effect generation** (spec §29): synthesizes an action/ambient sound cue for a shot from its action description via `SoundEffectProvider` (ElevenLabs Sound Effects API) — independent of dialogue, so a shot can carry both a spoken line and an action cue. Plays inline on the shot card next to the dialogue player.
- **Episode score generation** (spec §29): synthesizes one instrumental background score per episode via `MusicProvider` (ElevenLabs Music API), prompted from the story bible's genre/tone and the episode's synopsis — explicitly instructed to produce score-only audio, no vocals. Placed on the timeline against the episode as a whole (`TimelineItem.episodeId`, distinct from the per-shot dialogue/SFX placement) and playable inline on the episode card.
- All of the above run asynchronously through real BullMQ queues + a worker, with state-based progress in the UI (never a fake percentage)
- Stripe subscription checkout, customer portal, and webhook-driven subscription sync
- Admin dashboard (users, MRR, provider configuration status, plan table, recent jobs)

**Real, typed, wired interfaces — ready for the next phase without an architecture change:**
- Full AI provider abstraction (`packages/ai`) with real adapters for Anthropic (text), OpenAI (image), Runway (video), ElevenLabs (voice, sound effects, music) — each honestly reports "not configured" if its API key is absent, per the platform's no-fake-generation rule
- Full relational schema for characters, locations, wardrobe, props, scenes, shots, timeline, exports, publications — dialogue/SFX/music already write real `TimelineItem` rows against each shot or episode, which is exactly what the future timeline editor will read from
- Generation job state machine covering the entire QUEUED → PROVIDER_GENERATING → DOWNLOADING → VALIDATING → FINALIZING → SUCCEEDED/FAILED lifecycle, with per-job-type shortcuts (a text-only agent call skips straight to SUCCEEDED; a media job walks the full pipeline)

**Not yet built** (the next phase, per the spec's own phased roadmap): the timeline editor UI — episode export today auto-assembles shots in scene/shot order and auto-mixes each shot's dialogue/SFX plus the episode score, but there's no drag-and-drop re-sequencing or manual volume/timing control yet. Publishing/discovery is now live: a project becomes publishable once it has a real finished episode export, `/discover` and the home page show real Popular/New Releases rails backed by the `Publication` model, and viewers can favorite a movie (My List, and the Projects "Collection" tab) from a public `/watch/[id]` page — no login required to watch. Publication's `moderationStatus` field is tracked but not yet gated on (there's no moderation queue/admin flow yet, so every `PUBLIC` publication is immediately visible). The QC pass above checks structural/visual artifacts on sampled frames — it does not (yet) verify that the shot actually matches the requested action or continuity narrative, only that it doesn't look visibly broken. Trailer/social clip selection is a fixed rule (first shot of each scene, capped by duration), not an AI-scored "best moments" pass — that would need real shot-importance scoring this codebase doesn't attempt.

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind · PostgreSQL + Prisma · Redis + BullMQ · S3-compatible storage · Stripe · Auth.js (NextAuth v5) · Vitest

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable`)
- Docker (for Postgres/Redis/MinIO locally — or point at your own instances)
- FFmpeg on PATH for the worker process — required for episode export/assembly (`packages/media`). On Windows, install via `winget install Gyan.FFmpeg` (or download a build from ffmpeg.org and add its `bin` folder to PATH) and open a new terminal afterwards; on macOS, `brew install ffmpeg`; on Debian/Ubuntu, `apt-get install ffmpeg`. The `Dockerfile.worker` production image installs it automatically, so this only matters for `pnpm dev:worker` locally. Without it, exporting fails with an honest "FFmpeg is not installed" message rather than a fake file.

## 1. Install dependencies

```bash
pnpm install
```

## 2. Environment variables

```bash
cp .env.example .env
```

Fill in `.env`. See the comments in `.env.example` for what each variable does. Required to boot: `DATABASE_URL`, `REDIS_URL`, `STORAGE_*`, `AUTH_SECRET`. Everything else (Stripe, AI provider keys, Google OAuth) is optional — the app runs without them, and the relevant features honestly report "not configured" instead of faking output.

Generate `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

## 3. Start infrastructure

```bash
docker compose up -d postgres redis minio
```

Then create the MinIO bucket referenced by `STORAGE_BUCKET` (default `cinerra-media`) via the MinIO console at http://localhost:9001 (user/pass `cinerra` / `cinerra-secret`), or the `mc` CLI:

```bash
docker run --rm --network host minio/mc mc alias set local http://localhost:9000 cinerra cinerra-secret
docker run --rm --network host minio/mc mc mb local/cinerra-media
```

## 4. Database setup

`pnpm install` already ran the Prisma client generator automatically (a root `postinstall` hook), so you shouldn't need `pnpm db:generate` yourself unless you change `schema.prisma` later and want to regenerate without a full reinstall.

```bash
pnpm db:generate   # regenerate the Prisma client after a schema change (optional right after install)
pnpm db:migrate    # create the schema (prompts for a migration name on first run)
pnpm db:seed       # seed plans, AI model routing table, and (non-production) a demo project
```

The seed creates a demo account: `demo@cinerra.app` / `demo-password-1234`, subscribed to the Creator plan, with a fully-populated example project ("The Secret Between Us") showing the character/location/wardrobe/prop/scene/shot data model in practice.

## 5. AI provider setup (optional but required for actual generation)

Add whichever provider keys you have to `.env`:

- `ANTHROPIC_API_KEY` — powers the Story Architect, Screenwriter, Character Designer, Location Designer, and Director agents (Claude). **Required for any of the text generation flows to actually produce output** — without it, generation jobs fail with an honest "no language model provider is configured" message rather than faking a result.
- `OPENAI_API_KEY` — character/location/wardrobe/prop reference image generation, and the automated QC pass on generated shots (vision-model frame review). Without it, "Generate Reference" fails honestly instead of showing a placeholder image, and shots simply skip QC and go straight to `READY` — the same behavior as before this capability existed.
- `RUNWAYML_API_SECRET` — shot video generation. This is Runway's own documented environment-variable name for its API key (not an app-specific alias), so it matches what you'll get from Runway's dashboard/docs directly. Runway requires at least one reference image, so generate and approve a character reference first — without a configured provider, "Generate"/"Regenerate" on a shot fails honestly instead of faking a clip.
- `ELEVENLABS_API_KEY` — dialogue voice synthesis, sound effect generation, and episode music/score generation (three separate ElevenLabs APIs, one key). Without it, "Generate Dialogue Audio", "Generate Sound Effect", and "Generate Score" all fail honestly instead of faking a clip.

The `AiModel` table (seeded by `pnpm db:seed`) is the admin-editable routing table for which provider/model serves each capability under each optimization mode (`BEST_QUALITY` / `FASTEST` / `BALANCED`) — see `packages/ai`.

## 6. Stripe setup (optional)

1. Create four recurring Prices in your Stripe dashboard (monthly + yearly for each paid plan), then set `stripePriceIdMonthly` / `stripePriceIdYearly` on the corresponding `Plan` rows (via Prisma Studio: `pnpm db:studio`, or an admin UI once built).
2. Set `STRIPE_SECRET_KEY` in `.env`.
3. For local webhook testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, then set `STRIPE_WEBHOOK_SECRET` to the value it prints.
4. In production, add a webhook endpoint pointed at `https://yourapp.com/api/webhooks/stripe` subscribed to `checkout.session.completed`, `customer.subscription.*`, and `invoice.*` events.

## 7. Local development

```bash
pnpm dev          # Next.js app on http://localhost:3000
pnpm dev:worker   # BullMQ worker (in a second terminal) — required for generation jobs to actually run
```

Both the web app and the worker read the same `.env`.

## 8. Running tests

```bash
pnpm test          # unit tests across all packages (prompt compiler, continuity/code-generation helpers,
                    # job state machine, fair-use policy, provider router failover, storage key builder,
                    # password hashing, env validation)
pnpm typecheck      # TypeScript project-wide
```

## 9. Production deployment

- **Web**: `docker build -f Dockerfile.web -t cinerra-web .` — runs `next build` then `next start`. Deploy behind your platform of choice (any container host). Run `pnpm db:migrate:deploy` (via a release/init job) before starting new instances.
- **Worker**: `docker build -f Dockerfile.worker -t cinerra-worker .` — a long-running process, deploy as a separate service/pool from the web app so generation load never competes with request latency. Scale horizontally; BullMQ concurrency is per-instance (`WORKER_CONCURRENCY` env var, default 4) and per-user fair-use limits are enforced independently at enqueue time.
- **Full stack locally**: `docker compose up --build` brings up Postgres, Redis, MinIO, web, and worker together.

`GET /api/health` — liveness (process up). `GET /api/ready` — readiness (database reachable). Point your platform's health checks at these.

## 10. Webhook configuration

Only one inbound webhook exists today: `POST /api/webhooks/stripe`, signature-verified against `STRIPE_WEBHOOK_SECRET`. AI provider webhooks (e.g. Runway task completion) are not yet wired — the current video provider adapter polls instead; switching to a webhook-driven flow is a worker-side change only, the provider interface in `packages/ai` doesn't need to change.

## Repository layout

```
apps/
  web/       Next.js app — UI + API routes
  worker/    BullMQ worker — generation job processing
packages/
  ai/        Provider abstraction: interfaces, registry, router, adapters
  billing/   Stripe wrapper + fair-use policy (no customer-facing credits)
  config/    Env validation (Zod) + password hashing, shared everywhere
  database/  Prisma schema, client, seed script
  domain/    Agents (Story Architect, Screenwriter, Character/Location/Prop
             Designer, Director), prompt compiler, continuity engine +
             linking, job state machine + transition enforcement,
             reference image / shot video orchestration services
  queue/     BullMQ queue/worker definitions shared by web + worker
  storage/   S3-compatible object storage client
```

## The critical user flow, as it stands today

```
Sign up → Create Movie → Enter Story Idea → Generate
  → Story Architect generates the Story Bible + episode structure
  → Screenwriter generates the screenplay for an episode (scenes persisted)
  → Character Designer generates the character bible (lock any character)
  → Location Designer generates the location bible (lock any location)
  → Prop Designer generates the prop bible (lock any prop)
  → scenes are automatically reconciled to real characters/locations
  → Director agent breaks every scene into a shot list (storyboard),
    only referencing real props from the prop bible — matches become
    ScenePropLink/ShotProp rows
  → user generates a reference image per character/location (approve it),
    and per wardrobe/prop (regenerating directly replaces it, no approve
    step — see below)
  → user generates each shot's video (continuity-compiled prompt +
    approved reference image → Runway → durable storage → inline preview)
  → user generates dialogue audio for shots with speaking lines
  → user generates a sound effect cue for shots with action to score
  → user generates one instrumental score for the episode
  → once every shot is ready, user exports the episode (FFmpeg assembles
    shots + mixed dialogue/SFX/silence, then overlays the episode score,
    into one MP4 at the chosen resolution)
  → user generates a trailer and/or social clip at any point once the
    shots they'll use are ready (deterministic highlight cut, doesn't
    need the whole episode finished)
  → [next phase] timeline editor (drag-and-drop re-sequencing, manual
    volume/timing control) → publish
```

## Design principles this codebase holds to

- **No fake generation, ever.** An unconfigured AI provider throws a typed `ProviderNotConfiguredError`, surfaced to the user as a plain sentence — never a placeholder video or a silently "succeeded" job.
- **No customer-facing credits.** `packages/billing/fairUse.ts` is the entire enforcement mechanism behind "Unlimited AI Movie Creation" — a concurrency ceiling per plan, never a depletable balance.
- **Provider URLs never reach the browser.** Every AI provider result is downloaded and re-persisted to durable object storage (`StorageClient.downloadAndStore`) before it's referenced from the database.
- **Screenplay is never rewritten by generated video, and locked entities are never silently rewritten.** The source-of-truth hierarchy (Story Bible → bibles → screenplay → scenes → shots → prompt → video) is one-directional; nothing downstream writes back upstream automatically, and a locked Character/Location is a hard constraint even a full bible regeneration must respect.
