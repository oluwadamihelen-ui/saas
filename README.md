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
- Paystack subscription checkout, in-app cancellation, and webhook-driven subscription sync (no hosted portal — neither Paystack nor Korapay has one)
- Admin dashboard (users, MRR, provider configuration status, plan table, recent jobs)

**Real, typed, wired interfaces — ready for the next phase without an architecture change:**
- Full AI provider abstraction (`packages/ai`) with real adapters for Anthropic (text), OpenAI (image), Runway (video), ElevenLabs (voice, sound effects, music) — each honestly reports "not configured" if its API key is absent, per the platform's no-fake-generation rule
- Full relational schema for characters, locations, wardrobe, props, scenes, shots, timeline, exports, publications — dialogue/SFX/music write real `TimelineItem` rows against each shot or episode, which the timeline editor now reads and writes directly
- Generation job state machine covering the entire QUEUED → PROVIDER_GENERATING → DOWNLOADING → VALIDATING → FINALIZING → SUCCEEDED/FAILED lifecycle, with per-job-type shortcuts (a text-only agent call skips straight to SUCCEEDED; a media job walks the full pipeline)

This closes out the spec's original phased roadmap. The timeline editor (`/projects/[id]/episodes/[episodeId]/timeline`) lets a creator drag-and-drop reorder an episode's shots and adjust or mute each shot's dialogue/SFX volume and the episode score, all of which the export pipeline now actually respects — an untouched episode still exports in natural scene/shot order, but a manually reordered one uses that order instead. Its "timing" control is re-sequencing and mixing, not frame-accurate trimming — there's no waveform view or in/out-point scrubbing (`TimelineItem.startSeconds`/`endSeconds` exist in the schema but the editor doesn't expose them yet). Publishing/discovery: a project becomes publishable once it has a real finished episode export, `/discover` and the home page show real Popular/New Releases rails backed by the `Publication` model, and viewers can favorite a movie (My List, and the Projects "Collection" tab) from a public `/watch/[id]` page — no login required to watch. The QC pass above checks structural/visual artifacts on sampled frames — it does not (yet) verify that the shot actually matches the requested action or continuity narrative, only that it doesn't look visibly broken. Trailer/social clip selection is a fixed rule (first shot of each scene, capped by duration), not an AI-scored "best moments" pass — that would need real shot-importance scoring this codebase doesn't attempt.

Terms of Service and Privacy Policy pages now exist at `/terms` and `/privacy` (linked from a new site footer), and signup requires accepting both — recorded as `User.termsAcceptedAt`, never backfilled or assumed. Both are explicitly marked as a template draft for a lawyer to review, not legal advice. One known gap: Google OAuth sign-in (when configured) creates a user via NextAuth's own adapter, bypassing this checkbox, so `termsAcceptedAt` stays honestly null for those accounts rather than being fabricated.

Discover is now actually moderated: publishing sets `Publication.moderationStatus` to `PENDING` (every (re)publish re-queues it, even a previously-approved one), and only a publication an admin has approved from the new "Discover moderation queue" section on `/admin` shows up on `/discover`, the home page rails, or is reachable by a non-owner at `/watch/[id]` — a direct link can't bypass the queue. The owner can still preview their own pending/rejected submission at its watch URL, with a status banner, and sees the same status on their project page's Publish control. Moderation is a manual admin approve/reject action with an optional note (recorded in `AuditLog`); there's no automated content-safety scan.

The media library (`/assets`, spec §59) is real: a cross-project browser over every `Asset` row a user's projects have generated — character/location/wardrobe/prop references, storyboard frames, shot video, dialogue/SFX/music audio, exports, uploaded source documents — filterable by type and by project, each with a signed download link. It reads the existing `Asset.type`/`Asset.kind` columns directly rather than needing new plumbing, since every generation service already writes a real `Asset` row for what it produces.

`/profile` is real too: display name (editable), a password-change form (shown only for credentials accounts — OAuth-only accounts have no `passwordHash` to change), a Terms-acceptance readout, subscription/plan status with a "Manage billing" button wired to the Stripe customer portal endpoint that already existed but had no UI calling it, and a delete-account section pointing at the same `privacy@cinerra.app` contact flow the Privacy Policy describes (no self-serve deletion yet — that needs a real cascading-delete + Stripe-cancellation flow, intentionally out of scope here). There's still no per-user AI provider key concept in this codebase — provider keys are configured platform-wide via environment variables and shown read-only on `/admin`, not per-account.

A full security review pass (authorization checks across every API route, ffmpeg argument construction, storage-key/path handling, Stripe webhook verification, NextAuth session/role handling) found and fixed one real issue: `toggleFavorite` could be called directly with any publication ID by any authenticated user, regardless of whether that publication was actually approved/public yet — bypassing the same visibility gate the watch page enforces, and leaking a pending/rejected movie's title, poster, and creator name into a non-owner's My List. It now applies the identical `isPublicationPubliclyVisible` check the watch page uses. No other high- or medium-confidence findings.

CI now runs on every push and pull request (`.github/workflows/ci.yml`): typecheck + test in one job, a full production build in another, both pinned to Node 20 — matching `Dockerfile.web`/`Dockerfile.worker` and the `engines` field, and deliberately *not* whatever Node version happens to be on a given dev machine. That pin matters here: this environment's Node 22 makes `next build` fail with an internal `Cannot read properties of null (reading 'useContext')` error during static generation — confirmed, by literally downloading a Node 20 binary and re-running the same build, to be a Node 22/Next.js 14 incompatibility and not a bug in this code. Setting up CI also surfaced a second, real, pre-existing bug: the root `build` script tried to run a `build` step in every `packages/*` workspace, but none of them ever had one — they're consumed as raw TypeScript source (via `transpilePackages` in Next.js and `tsc`'s own cross-package resolution in the worker), so that step always failed the moment anyone actually ran `pnpm build` from the repo root. Fixed by dropping the dead step. `pnpm lint` is excluded from CI for now — `next lint` has never been configured (no `.eslintrc`, no `eslint`/`eslint-config-next` dependency) and fails immediately on an interactive prompt; every other package's `lint` script is a no-op stub. Setting up real linting is left for a future pass rather than silently expanding this one.

The two genuinely unauthenticated write paths are now rate limited, backed by Redis (`packages/queue`'s `createRedisClient` + `apps/web/src/lib/rateLimit.ts`'s fixed-window `INCR`/`EXPIRE` counter) rather than an in-memory counter, which wouldn't hold up across more than one server instance: signup (`checkSignupRateLimit`, 5/hour per IP — wired into *both* the JSON `/api/auth/signup` route and the signup page's server action, since only the latter is what the actual UI form submits to) and credentials sign-in (`checkLoginRateLimit`, 10/15min keyed by the *attempted email* rather than IP, since a distributed brute-force targeting one account would evade a per-IP limit; a rate-limited attempt fails identically to a wrong password, never revealing that a limit was hit). Verified against a real local Redis instance, not just type-checked. Other unauthenticated GETs (`/watch/[id]`, `/discover`, `/terms`, `/privacy`) are read-only and unrate-limited — DoS/abuse-volume concerns on those are explicitly out of scope here (see the security review above).

Error monitoring is wired via `@sentry/node` (deliberately not the full `@sentry/nextjs` SDK — no source-map upload, no build-time webpack plugin, nothing that could change build output; just Node's own `Sentry.init`/`captureException`), gated on an optional `SENTRY_DSN` the same way every other provider in this codebase degrades honestly when unset. It hooks into the two chokepoints every server-side error already flows through rather than touching individual routes: `apps/web/src/lib/apiError.ts`'s catch-all (every API route) via a Next.js `instrumentation.ts` startup hook (`experimental.instrumentationHook` — still required to opt in on Next 14.x, stable by default starting Next 15), and `apps/worker/src/index.ts`'s `withJobLogging` catch block plus `unhandledRejection`/`uncaughtException` process handlers for the worker. `captureException` is safe to call unconditionally even when Sentry was never initialized (verified directly, not assumed). Client-side (in-browser) React error capture is out of scope — that needs a separate browser-compatible SDK and a `NEXT_PUBLIC_SENTRY_DSN`, deliberately not added here to keep this a small, low-risk addition rather than the heavier `@sentry/nextjs` setup. Setting this up caught a real, separate bug on the way in: `apps/web/src/lib/rateLimit.ts` (added last phase) constructed its Redis client eagerly at module load, which — since it's imported by `auth.ts`, which nearly every page pulls in via `Header`'s `auth()` call — meant `next build`'s static-generation phase was attempting a real Redis connection and spamming `[ioredis] Unhandled error event` for every build. Fixed by constructing it lazily on first actual rate-limit check, matching the pattern `lib/queue.ts` already used; confirmed by diffing build output before/after.

Transactional email now exists via `packages/email` (a single-provider Resend abstraction, mirroring `packages/storage`'s simple pattern rather than `packages/ai`'s multi-provider router — there's no failover need for one email vendor): an `EmailClient` interface with a real `ResendEmailClient` and an honest `NoopEmailClient` fallback that logs what it would have sent when `RESEND_API_KEY` is unset, same degrade pattern as every other optional integration here. This also corrects something the previous "remaining before launch" note got wrong: the `Notification` model isn't actually used for in-app notifications anywhere in this codebase — it has zero rows created by anything — so there was no in-app system to route around; the real gap was simply that nothing sent email at all. Three things now do: a welcome email on signup (best-effort, non-blocking — a failed or unconfigured send never blocks account creation); a password reset flow built on the previously-unused `PasswordResetToken` model (`/forgot-password` requests a random 32-byte token, rate-limited 5/hour per IP via a new `checkPasswordResetRateLimit`, always shows the same confirmation regardless of whether the email exists to avoid email enumeration; `/reset-password?token=...` consumes it within a 1-hour TTL, single-use); and export-ready/export-failed notifications from `runEpisodeExportJob`, emailed to the project owner. One documented rough edge: BullMQ's retry logic means a transient export failure can still succeed on retry, but the failure email fires on every failed attempt (not just final exhaustion) — an accepted tradeoff over the added complexity of attempt-exhaustion detection, since FFmpeg failures here are overwhelmingly deterministic rather than transient.

`/profile`'s "Delete account" section is now real self-serve deletion, not a support-email pointer. Any live Stripe subscription is cancelled first — subscription status only ever changes via a verified webhook (spec §44), and once the account is gone there's no local row left for a late webhook to update, so a subscription left uncancelled would keep billing the customer forever with nothing here to stop it; that cancellation is treated as a hard requirement rather than something that degrades silently, and a failed cancel blocks the deletion rather than proceeding anyway. The account, every project it owns, and everything under those projects (story bibles, characters, shots, exports, publications, favorites others made of its published movies) are then deleted in one transaction — deleting the owned projects first, ahead of the user row itself, turned out to matter: `Publication.publishedById` has no cascade of its own, so a plain "delete this user" throws a foreign-key violation the moment they've ever published anything, and deleting their projects first clears that path before the user row's own delete is attempted. This was verified against a real local Postgres instance (this sandbox has no Docker daemon, so a real `postgresql-16` server package was installed and started directly) rather than reasoned about on paper, since a multi-path cascade like this is exactly the kind of thing that looks fine in the schema and then isn't. The confirmation UI requires typing the account's own email before the delete button enables, and the server action re-validates that match itself rather than trusting the client. Deletion signs the session out immediately afterward (`next-auth`'s own `signOut`) — this app uses JWT sessions, so the signed cookie would otherwise keep authenticating as a user ID that no longer exists in the database until it expired on its own.

Adaptation Mode's source material step now accepts a real file upload, not just pasted text: `POST /api/projects/source-document` parses a PDF (`pdf-parse`), DOCX (`mammoth`), or TXT upload into plain text synchronously — no queue/job, since a manuscript-sized document parses well within a request — populates the wizard's textarea (still editable before submitting), and separately persists the original file to storage under `sourceFileKey` for the record. Both libraries were verified against real generated PDF/DOCX fixtures (not just typechecked) before wiring them in, given a past phase's precedent of a dependency behaving fine in isolation but breaking Next.js's build; a real production build was re-run afterward to confirm neither introduces a bundling issue. Unsupported file types and unreadable/empty documents (scanned images, a password-protected PDF) return a clear error rather than a blank textarea.

`/studio` is a real first slice of Studio-plan team collaboration, not a placeholder anymore — scoped deliberately narrow given how large "team collaboration and commercial production tools" could otherwise become. A subscriber on a plan with more than one seat (`Plan.seats`, currently only the seeded "studio" plan) can create an `Organization`, invite teammates by email (a new `organizationInviteEmail` template through `@cinerra/email`, a signed token with a 7-day expiry on the previously-unused `Organization`/new `OrganizationInvite` models), and see who's on the roster with a seat-usage counter; the owner can remove a member, and any member can leave. Seat capacity is enforced both when sending an invite and when it's accepted, since the two can race. Deleting the owner's account deletes the organization and its pending invites with it (no ownership-transfer flow exists yet) while members are simply unaffiliated rather than deleted — verified against a real Postgres instance alongside the equivalent non-owner-member-deletion path, since this is exactly the kind of multi-relation cascade that bit `Publication.publishedById` in an earlier phase; `OrganizationInvite` deliberately stores who sent it as a plain name snapshot rather than a live foreign key, avoiding a second cascade edge that would have reintroduced the same class of bug. Explicitly **not** built here: shared or collaborative access to a teammate's projects (every project stays visible only to its own owner, exactly as before — org membership today is roster-only), roles beyond Owner/Member, ownership transfer, and any commercial-production tooling beyond team membership itself.

## Coin economy / creator monetization

A real viewer-coin economy and 50/50 creator revenue split now exists — built as a genuine marketplace-style financial system (immutable ledger, atomic unlock transactions, verified webhooks, reversal handling), not a mutable balance counter. Ships in two parts, in this order:

**Core financial system (built, tested against real Postgres):**
- **Wallet + ledger**: every user has a `Wallet` (a cached balance) backed by an append-only `WalletTransaction` ledger — the ledger is the source of truth; the cached balance is always written in the same DB transaction as the ledger row that changes it, never on its own. Nothing is ever deleted from the ledger; a correction is always a new row referencing the original via `reversesId`.
- **Coin purchases**: admin-configurable `CoinPackage` rows (coins, bonus coins, fiat price, active flag — nothing hard-coded), a real one-time-payment checkout on either Paystack or Korapay (viewer's choice), and a webhook handler that only credits coins once the provider confirms `charge.success` — never on the strength of the frontend's own "success" redirect. Idempotent: `CoinPurchase.providerReference` is unique (a reference *we* generate at checkout and the provider echoes back on every webhook for that charge), so a replayed webhook event finds the purchase already `COMPLETED` and no-ops.
- **Content pricing**: a project is either free or paid at exactly one scope — the whole movie, or per episode (scene-level pricing exists in the data model and domain logic per the spec, but isn't exposed in the creator UI or enforced on the watch page yet, since there's no per-scene exported/streamable video in this codebase — only per-episode export exists — so there's nothing to actually gate at that granularity; wiring that up is future work once scene-level export exists). Admin-configurable suggested price ranges live in a `PlatformSettings` singleton row, never hard-coded.
- **Entitlements + the atomic unlock**: `unlockContent` (`apps/web/src/lib/monetization.ts`) is the one critical transactional operation — checks for an existing entitlement, resolves price and publisher **server-side from the database** (never trusting anything the client sends), locks the wallet inside one DB transaction, deducts coins, creates the entitlement, splits revenue 50/50 (configurable via `PlatformSettings.publisherRevenueShareBps`, in basis points — never hard-coded as a literal 50/50 in application code), and commits everything together or rolls back everything together. Concurrency safety comes from `WalletTransaction.idempotencyKey`'s database-level unique constraint, not from the entitlement check alone — a losing concurrent request's entire transaction aborts on that constraint, so it never touches the wallet balance.
- **Rounding**: the publisher's share is `floor(price × shareBps / 10000)`; the platform absorbs the remainder, so a viewer's debit always exactly equals `publisherShare + platformShare` with no leakage. Documented once, applied everywhere.
- **True double-entry bookkeeping**: a seeded, non-login "Cinerra Platform" system account holds its own Wallet, so every settled unlock credits three real ledger rows (viewer debited, publisher credited, platform credited) that always sum to zero — not a derived "platform revenue" figure trusted without a matching ledger entry.
- **Reversals** (`reverseContentUnlock`, admin-only): mirrors the original transaction — viewer refunded, publisher and platform both debited back — and marks the `CreatorEarning` `REVERSED` so it can never be paid out, whether or not it had already cleared its settlement hold. Revoking the viewer's access is a separate policy flag, not automatic.
- **Refunds on the purchase side**: a Paystack `refund.processed` or Korapay `refund.success` webhook reverses the original `COIN_PURCHASE` ledger credit (never deleting it) and marks the `CoinPurchase` `REFUNDED`; idempotent the same way completion is.

Verified directly against a real Postgres instance, not just typechecked: two concurrent identical unlock requests produce exactly one charge and one entitlement (never a double charge); a sequential re-unlock is a no-op; insufficient balance blocks cleanly with no partial state; a 21-coin price splits 10/11 exactly as documented; a full reversal restores wallet balances to their pre-unlock state and a second reversal attempt is rejected; a duplicate webhook delivery (both purchase-completed and refund, on either provider) never double-applies.

**Three real bugs were found and fixed by that testing, not by inspection** — worth calling out because each is exactly the kind of subtle correctness issue a financial system can't ship with:
1. The `CONTENT_UNLOCK` ledger row's `referenceId` was never actually set (an ordering bug — the entitlement didn't exist yet when the wallet transaction was recorded), which would have made a later reversal unable to find its own original transaction to reverse. Fixed by creating the entitlement first.
2. `reverseContentUnlock` originally *deleted* the `ContentEntitlement` row when revoking access — which, via `RevenueTransaction`'s `onDelete: Cascade` relation to it, cascaded away the very `RevenueTransaction`/`CreatorEarning` rows the whole function exists to preserve, silently violating the "never delete settled financial transactions" rule this system is built around. Fixed by adding `ContentEntitlement.revokedAt` and marking revocation instead of deleting the row — `getContentAccess`/`unlockContent` now treat a revoked entitlement as not granting access, without touching the permanent record underneath it.
3. `deleteUserAccount` could destroy *other people's* settled financial records through three separate cascade paths: a publisher deleting their account cascade-deleted their `Project`s, which cascaded away every viewer's `ContentEntitlement`/`RevenueTransaction`/`CreatorEarning` for that content; a viewer deleting their account did the same via `ContentEntitlement.user`; and `RevenueTransaction.publisher`/`.viewer` had *direct* `onDelete: Cascade` relations to `User`, so either party's deletion destroyed the record regardless of path. Fixed by changing every `RevenueTransaction`/`CreatorEarning` relation to `User`/`Project`/`Episode`/`Scene`/`ContentEntitlement` from `Cascade` to `SetNull` (with the FK columns made optional) and snapshotting `projectTitle`/`episodeTitle` at creation time, so the transaction/earnings history stays legible and intact — just with the deleted party's FK nulled out — no matter which side deletes their account. `reverseContentUnlock` now reverses whichever legs (viewer/publisher/platform) are still live, skipping a leg only when that party's account is actually gone. Verified against real Postgres for both deletion orderings (viewer-deletes-first and publisher-deletes-first).

**UI, built as a first pass**: a Coin balance chip in the header linking to `/wallet` (balance, buy-Coins grid, recent activity); an unlock paywall on `/watch/[id]` with the spec's confirm-before-charging flow (cost, current balance, balance after) and an honest "not enough Coins" state with a link to buy more; monetization controls on the project page (Free/Paid, Movie/Episode charge level, price inputs with a live "viewer pays / you earn / Cinerra earns" preview); and `/earnings` — a real earnings summary (available/pending/lifetime/this-month, paid unlocks, coin revenue, a per-unlock transaction history table) for creators.

**Explicitly out of scope for this phase** (per the plan's own 14-phase ordering — built the ledger/wallet/purchase/pricing/entitlement/unlock/split foundation solidly first rather than rushing everything at once):
- **Creator payouts** — built: a creator connects a payout account (Paystack or Korapay, their choice), verified by the provider's own account-resolution API rather than trusting a typed-in account number; `/earnings` shows the real available-to-withdraw balance and a Withdraw button, gated on `PlatformSettings.payoutMinimumCoins`; requesting a payout claims the creator's `AVAILABLE` `CreatorEarning` rows and calls the provider's real Transfer (Paystack) or Disburse (Korapay) API; `transfer.success`/`transfer.failed` webhooks mark the payout `PAID` or `FAILED` and, on failure, release the claimed earnings back to `AVAILABLE` so the creator can retry. `CreatorEarning.status` now does transition `PENDING` → `AVAILABLE` automatically — a repeatable BullMQ job in the worker runs hourly. Concurrency: claiming earnings for a payout runs in a `Serializable` Postgres transaction (not an idempotency-key unique constraint, unlike every other race in this codebase — there's no single natural key here, since a claim spans a *set* of earning rows), verified against real Postgres that two concurrent withdrawal requests for the same creator can't both claim the same earnings. Explicitly deferred: fraud/risk controls on payouts, a bank-list dropdown (creators type a bank code directly today), and admin approval before a creator's first payout.
- **Fraud/risk controls** (self-purchase detection, device/IP collusion signals, refund-abuse detection, rate limiting on purchases/unlocks) — none of this exists yet. A creator watching their own paid content for free is allowed (no money moves, nothing to detect), which is different from and does not address the fraud pattern the spec describes.
- **Analytics** — built: `/admin` has a revenue analytics section (all-time coin revenue and its publisher/platform split, average revenue per viewer, a 30-day daily-revenue chart, top-10 movies/episodes and top-10 creators by revenue), computed entirely from `RevenueTransaction`. It also now has a content-engagement section (playback starts, completion rate, most-watched content, all last-30-days) backed by real `ViewingEvent` writes — `apps/web/src/components/watch/WatchPlayer.tsx` fires STARTED on first play, QUARTER/HALF/THREE_QUARTER via `timeupdate` percentage thresholds (deduped per mount), and COMPLETED on `ended`, posting to `/api/viewing-events` (anonymous viewing included — `userId` is nullable, same null-safe pattern as `getContentAccess`). Still deliberately no purchase-conversion-rate metric, though — and this turned out to be a structural limit, not just a missing-data one: the watch page only ever renders a `<video>` for content the viewer *already has access to* (free or already-unlocked), so there's no "saw the paywall" event anywhere to measure a real view→purchase funnel from. `ViewingEvent` alone can only ever measure engagement with content people can already watch, never the funnel into unlocking it — a real conversion metric would need a new "paywall impression" event, not just wiring the one that already existed.
- ~~**Promotional coins** and coin expiration~~ — built: a new `PromotionalGrant` model tracks each grant's original and *remaining* coin amount separately from the fungible `Wallet.balance` it credits via a real `PROMOTIONAL_CREDIT` ledger row, because once credited a promotional coin is indistinguishable from a purchased one in the balance alone — `PromotionalGrant.remainingCoins` is the only thing that remembers which coins are still "promotional and expiring." An admin section on `/admin` grants a fixed batch of coins to any user by email with an expiry (days) and optional reason, via `POST /api/admin/promotional-grants`. Every unlock spend (`unlockContent`) now also calls `consumePromotionalCoins`, a bookkeeping-only FIFO draw-down (soonest-expiring grant first) that runs *alongside*, never gating or redirecting, the real wallet debit. A new daily repeatable BullMQ job (`expirePromotionalGrants`, in `packages/database` so both the worker and the web app import the exact same function) reclaims each grant's unspent balance once `expiresAt` passes, debiting `min(remainingCoins, currentBalance)` — deliberately never negative, unlike a refund/chargeback reversal, because reclaiming unused free credit is not collecting a debt. `/wallet` shows the viewer's own active grants and expiry dates, so an expiring promo coin is never invisible until it's gone. Verified against real Postgres: a grant credits the wallet correctly; a spend consumes the soonest-expiring grant first; a spend larger than one grant spills into the next; the expiration job caps its debit at the current balance and never goes negative; re-running the expiration job against an already-expired, zero-remaining grant is a no-op (no duplicate ledger row). Still explicitly out of scope: any UI to browse/revoke a specific past grant (only the aggregate "active grants" view exists), and no limit on how many promotional grants an admin can issue.

**Remaining before launch** (not part of the original phased roadmap, but needed for a real public launch): closing the Google-OAuth terms-acceptance gap noted above, real ESLint setup (`next lint` has never been configured, per the CI note above), client-side error capture (noted above), and the coin-economy gaps listed just above (fraud/risk controls on payouts and purchases — creator payouts, the settlement-period transition, the account-deletion cascade interaction, the Stripe-to-Paystack/Korapay migration, rate limiting, the PlatformSettings admin UI, revenue analytics, real ViewingEvent-backed engagement tracking, and promotional coins/coin expiration have all since been completed, see the notes above).

## Tech stack

Next.js 14 (App Router) · TypeScript · Tailwind · PostgreSQL + Prisma · Redis + BullMQ · S3-compatible storage · Paystack + Korapay · Auth.js (NextAuth v5) · Vitest

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

Fill in `.env`. See the comments in `.env.example` for what each variable does. Required to boot: `DATABASE_URL`, `REDIS_URL`, `STORAGE_*`, `AUTH_SECRET`. Everything else (Paystack, Korapay, AI provider keys, Google OAuth) is optional — the app runs without them, and the relevant features honestly report "not configured" instead of faking output.

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

## 6. Billing setup (optional)

**Subscriptions (Paystack)** — Korapay has no subscription/recurring-billing product, so subscriptions run on Paystack only:
1. Create four recurring Plans in your Paystack dashboard (monthly + yearly for each paid tier), then set `paystackPlanCodeMonthly` / `paystackPlanCodeYearly` on the corresponding `Plan` rows (via Prisma Studio: `pnpm db:studio`, or an admin UI once built).
2. Set `PAYSTACK_SECRET_KEY` in `.env`. Paystack has no separate webhook-signing secret — the secret key itself signs webhook payloads (`x-paystack-signature`, HMAC-SHA512).
3. In your Paystack dashboard, add a webhook endpoint pointed at `https://yourapp.com/api/webhooks/paystack`.
4. There's no hosted customer portal on Paystack (or Korapay) the way Stripe has — subscription cancellation is a direct in-app action (`/profile` → "Cancel subscription") that calls Paystack's `/subscription/disable` API instead.

**Coin purchases (Paystack and/or Korapay, viewer's choice)**:
1. Set `PAYSTACK_SECRET_KEY` and/or `KORAPAY_SECRET_KEY` in `.env` — the buy-Coins page only offers whichever provider(s) are actually configured, and shows a provider picker only when both are.
2. Korapay wants the checkout amount in the *major* currency unit (naira, not kobo) — the opposite of Paystack's minor-unit convention — `createCoinPurchaseCheckout` converts for you; nothing to configure here.
3. In your Korapay dashboard, add a webhook endpoint pointed at `https://yourapp.com/api/webhooks/korapay`; Korapay signs webhook payloads with `x-korapay-signature`, an HMAC-SHA256 of just the `data` object (not the full body) using the secret key.
4. Paystack's webhook endpoint is the same one subscriptions use (`https://yourapp.com/api/webhooks/paystack`) — it dispatches by event type, so no separate setup is needed for coin purchases once step 3 of the subscriptions setup above is done.

**Creator payouts (Paystack Transfer API and/or Korapay Payout API, creator's choice)** — reuses the same `PAYSTACK_SECRET_KEY`/`KORAPAY_SECRET_KEY` and webhook endpoints above; `transfer.success`/`transfer.failed` are dispatched from the same two webhook routes coin purchases and subscriptions already use:
1. Set `PlatformSettings.payoutCoinValueCents` and `payoutCurrency` (via Prisma Studio) — the coin-to-fiat conversion rate paid out to creators; there's no admin UI for this yet, only direct DB access, same as the other `PlatformSettings` fields.
2. If OTP is enabled on your Paystack dashboard for transfers, automated payouts will stall waiting for an OTP this code never supplies — disable OTP for API-initiated transfers in the dashboard settings, or payouts will need manual completion every time.
3. Both providers require their own account balance to be funded before a transfer/disbursement succeeds — a payout call against an empty balance fails at the provider, which this code surfaces as a `FAILED` `Payout` with the earnings released back for retry, not a crash.

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

Two inbound webhooks exist today: `POST /api/webhooks/paystack` (subscription lifecycle AND coin purchases on Paystack, dispatched by event type, signature-verified against `PAYSTACK_SECRET_KEY` itself — Paystack has no separate webhook-signing secret) and `POST /api/webhooks/korapay` (coin purchases on Korapay, signature-verified against `KORAPAY_SECRET_KEY` — HMAC-SHA256 of just the `data` object, not the full body). AI provider webhooks (e.g. Runway task completion) are not yet wired — the current video provider adapter polls instead; switching to a webhook-driven flow is a worker-side change only, the provider interface in `packages/ai` doesn't need to change.

## Repository layout

```
apps/
  web/       Next.js app — UI + API routes
  worker/    BullMQ worker — generation job processing
packages/
  ai/        Provider abstraction: interfaces, registry, router, adapters
  billing/   Paystack + Korapay wrappers + fair-use policy
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
