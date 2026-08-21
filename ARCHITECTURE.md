# Cinerra — AI Movie Generation Platform

Architecture reference. This document is the source of truth for how the system is built. It is written before implementation and kept up to date as the codebase evolves.

Brand: **Cinerra** — "cinema" + "era". Original brand, not derived from any reference product.

---

## 1. Product Architecture

```
IDEA / SOURCE MATERIAL
   -> Story Bible                (Story Architect agent)
   -> Character / Location / Wardrobe / Prop Bibles   (Designer agents)
   -> Screenplay                 (Screenwriter agent)
   -> Scene Breakdown            (Scene Engine)
   -> Shot List                  (Director agent)
   -> Generation Prompts         (Prompt Engineer + Continuity Engine)
   -> Video / Image jobs         (Generation Orchestrator -> Model Router -> Queue -> Provider)
   -> Quality Control            (QC agent)
   -> Audio (dialogue/SFX/music) (Audio Director agent)
   -> Timeline / Assembly        (Editor agent)
   -> Export / Publish
```

Every arrow is a persisted, versioned, editable artifact in Postgres — never an ephemeral prompt string. The hierarchy in spec §63 is enforced at the data layer: a shot cannot be generated without resolving its scene, which cannot exist without a screenplay, which cannot exist without a Story Bible. Generated video never writes back into the screenplay; only a human action (or an agent proposal a human approves) can mutate canonical bible data.

## 2. Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + React + TypeScript | SSR for cinematic marketing/dashboard pages, RSC for data-heavy screens, one deploy target for UI+API |
| API | Next.js Route Handlers (`apps/web/src/app/api/**`) calling into `packages/domain` services | Avoids a second HTTP hop for a v1; domain logic lives in framework-agnostic packages so a NestJS split later is a lift-and-shift, not a rewrite |
| Background workers | Standalone Node/TypeScript process (`apps/worker`), BullMQ | Video/image/voice generation and export are long-running — must never block a request thread |
| Database | PostgreSQL 16 | Relational integrity for the continuity graph (characters/locations/wardrobe/props/scenes/shots) is a correctness requirement, not a preference |
| ORM | Prisma | Type-safe schema-as-code, migrations, good fit for a large relational graph |
| Queue | Redis + BullMQ | Priority queues, exponential backoff, dead-letter, concurrency control — all first-class |
| Object storage | S3-compatible (AWS S3 in prod, MinIO in dev) | Video/image binaries never touch Postgres |
| Media processing | FFmpeg (via `fluent-ffmpeg`) in the worker | Transcode, thumbnail, waveform, concat, mux |
| Auth | Auth.js (NextAuth) v5, credentials + OAuth, bcrypt | Production-grade session/JWT handling without hand-rolling crypto |
| Billing | Stripe (Checkout + Customer Portal + Webhooks) | Subscriptions only — no credit ledger exposed to customers |
| Validation | Zod | Runtime validation at every API boundary and env parse |
| Testing | Vitest (unit/integration), Playwright (e2e) | Fast TS-native unit runner; Playwright for the signup->export critical path |

## 3. Monorepo Layout

```
saas/
  apps/
    web/            Next.js app (UI + API routes)
    worker/          BullMQ worker process (generation, media processing, export)
  packages/
    database/        Prisma schema, migrations, generated client, seed script
    domain/           Framework-agnostic domain services (agents, engines, state machines)
    ai/               AI provider abstraction: interfaces, router, adapters
    queue/            BullMQ queue/worker definitions shared by web + worker
    storage/          Object storage client abstraction (S3/R2/MinIO)
    billing/          Stripe abstraction + plan/fair-use policy resolution
    config/           Env parsing/validation (Zod), shared across all apps
  docker-compose.yml  postgres, redis, minio, web, worker
  Dockerfile.web
  Dockerfile.worker
  .env.example
```

Rationale: `packages/domain` never imports Next.js or BullMQ directly — it exposes plain functions/classes so both `apps/web` (for synchronous reads/mutations) and `apps/worker` (for job execution) can call the same continuity engine, prompt compiler, and agent implementations without duplication.

## 4. AI Provider Architecture

```
packages/ai/
  types.ts            Provider interfaces (VideoProvider, ImageProvider, LanguageModelProvider, ...)
  registry.ts         ProviderRegistry — holds configured provider instances by capability
  router.ts           ModelRouter — resolves (capability, optimizationMode) -> provider+model
  providers/
    anthropic/         LanguageModelProvider implementation (Claude)
    openai/             LanguageModelProvider + ImageProvider implementation (optional)
    runway/             VideoProvider implementation (image-to-video, video-to-video)
    elevenlabs/         VoiceProvider implementation
    unconfigured.ts     Honest "not configured" provider for any capability with no key set
```

Every capability (`generateText`, `generateImage`, `generateVideo`, `generateImageToVideo`, `generateVideoToVideo`, `generateVoice`, `generateSoundEffect`, `generateMusic`, `analyzeImage`, `analyzeVideo`) is a method on a typed interface in `types.ts`. `apps/worker` and `apps/web` only ever depend on these interfaces plus `ModelRouter` — never on a concrete SDK. Swapping Runway for another video vendor means adding one adapter file and an `ai_models` DB row; zero call-site changes.

Admin-configurable **optimization modes** (`BEST_QUALITY`, `FASTEST`, `BALANCED`) map to provider+model combinations via the `AiModel` table (see schema), editable from `/admin/providers` — never hard-coded.

If no provider is configured for a capability, `UnconfiguredProvider` is returned by the registry and every call throws a typed `ProviderNotConfiguredError`, which the API surfaces as the honest message required by spec §81 — never a fake success.

## 5. Queue Architecture

```
Browser -> API route -> validates + persists GenerationJob(status=QUEUED) -> enqueues BullMQ job
                                                                                      |
                                                                                      v
                                                                            apps/worker picks up job
                                                                            -> status=PROCESSING
                                                                            -> resolves continuity refs
                                                                            -> ModelRouter picks provider
                                                                            -> status=PROVIDER_GENERATING
                                                                            -> polls/receives webhook
                                                                            -> status=DOWNLOADING
                                                                            -> downloads to storage
                                                                            -> status=VALIDATING (QC agent)
                                                                            -> status=FINALIZING
                                                                            -> status=SUCCEEDED | FAILED
```

Queues (`packages/queue/queues.ts`): `story-generation`, `script-generation`, `asset-generation` (character/location/wardrobe/prop reference images), `shot-generation` (video), `audio-generation`, `export`. Each queue has its own concurrency and retry policy; per-plan concurrency limits are enforced by a BullMQ rate limiter keyed on `userId` + plan, values sourced from `FairUsePolicy` (packages/billing), not hard-coded.

Retries: exponential backoff (3 attempts default, configurable per job type). After max attempts, the job moves to a dead-letter state (`GenerationJob.status = FAILED`, `ProviderTask` row retained for admin inspection) rather than disappearing.

## 6. Storage Architecture

All binary media (images, video, audio, exports) is written to S3-compatible object storage under a per-project prefix (`projects/{projectId}/{assetType}/{assetId}.{ext}`) and referenced from Postgres by key, never by raw provider URL. The worker downloads every provider result and re-uploads it to durable storage before marking a job succeeded — provider URLs are typically signed/short-lived and must never be served to end users directly (spec §40). Signed GET URLs (or a CDN in front of the bucket) are generated on read.

## 7. Subscription Architecture

No credit balance is ever stored against a user-facing concept. `Plan` rows (admin-editable, priced in cents, monthly+annual Stripe price IDs) define **fair-use policy**, not a wallet:

```
Plan
  maxConcurrentGenerations
  queuePriority        (LOW | NORMAL | HIGH | HIGHEST)
  maxExportResolution
  maxStorageGB
  maxProjectDurationMinutes
  seats (team collaboration, Studio only)
```

`Subscription` rows track Stripe state (`status`, `currentPeriodEnd`, `cancelAtPeriodEnd`) synced exclusively via Stripe webhooks — the frontend is never trusted as the source of subscription truth. `packages/billing/fairUse.ts` resolves "can this user start another generation right now?" from plan + current in-flight job count; the UI only ever shows queue position / `Generating…`, never a number that implies a depletable balance. Internal cost tracking (`ProviderTask.costCents`, duration, retries) is admin-only data joined for the cost dashboard and is never returned by any customer-facing endpoint.

## 8. Database Architecture (summary — full schema in packages/database/prisma/schema.prisma)

Core relational entities: `User`, `Organization`, `Plan`, `Subscription`, `Project`, `StoryBible`, `Episode`, `Character`, `CharacterReference`, `Location`, `LocationReference`, `Wardrobe`, `Prop`, `Scene`, `Shot`, `Asset`, `GenerationJob`, `ProviderTask`, `AiModel`, `AudioItem`, `TimelineItem`, `Export`, `Publication`, `Notification`, `AuditLog`. Flexible/variable-shape data (e.g. a shot's compiled prompt sections, a character's freeform continuity notes) uses typed JSON columns; every relationship that generation depends on for continuity (character-in-scene, wardrobe-in-shot, prop-in-shot, location-in-scene) is a real foreign key / join table, not JSON, so the continuity engine can query it reliably.

## 9. API Architecture

REST-ish route handlers under `apps/web/src/app/api/**`, e.g.:

```
POST   /api/projects
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects/:id/story/generate
POST   /api/projects/:id/script/generate
POST   /api/projects/:id/characters/generate
POST   /api/projects/:id/locations/generate
POST   /api/projects/:id/storyboard/generate
POST   /api/shots/:id/generate
POST   /api/shots/:id/regenerate
POST   /api/projects/:id/export
GET    /api/jobs/:id
POST   /api/jobs/:id/cancel
POST   /api/billing/checkout
POST   /api/billing/portal
POST   /api/webhooks/stripe
GET    /api/health
GET    /api/ready
```

Every route under `/api/**` except `/api/health`, `/api/ready`, and `/api/webhooks/**` requires an authenticated session and re-checks resource ownership/org membership server-side (never trusts a client-supplied `projectId` without a DB-level ownership check).

## 10. Implementation Phases

Phase 1 (Foundation), Phase 2 (Story Engine), Phase 3 (Production Engine), Phase 4 (AI Video), Phase 5 (Audio), Phase 6 (Editor), Phase 7 (Publishing), Phase 8 (Admin) — as enumerated in the product spec. This build delivers Phase 1 fully, Phase 2 substantially (Inspiration Mode end-to-end against a real LLM provider), and lays down real, typed, wired-but-honestly-unconfigured interfaces for Phases 3-6 so no phase requires an architectural rewrite to complete — only additional adapters and UI screens against the same contracts.
