# CleanSweep — Phone Cleaner App: Design Doc

## 1. Problem & scope

An on-device utility that helps a user reclaim storage and tidy their phone:
find and delete duplicate/similar photos & videos, surface large/old files,
uninstall unused apps, and clear reclaimable cache/junk.

**Platform decision:** native Android (Kotlin). Real cleaning requires
`MediaStore`, `PackageManager`, `StorageStatsManager` and `UsageStatsManager`
access that iOS's sandbox does not expose to third-party apps, so iOS is out
of scope for the "real cleaning" features. A future iOS client could ship a
much smaller feature set (in-app photo library duplicate cleanup only).

**Important constraint that shapes the whole design:** since Android 8,
apps cannot read or clear *other* apps' cache/data, and since Android 10
(scoped storage) they cannot silently delete files they don't own. So
"Clean Cache" for a legitimate, non-rooted app means:
- Full read/delete access to the app's **own** cache and to **media** the
  user grants access to (photos, videos, downloads) via `MediaStore`.
- **Consent-gated** bulk delete of other apps' media, using
  `MediaStore.createDeleteRequest` (API 30+) / `RecoverableSecurityException`
  (API 29) — one system confirmation dialog, not silent deletion.
- **No** silent uninstall or cache-clear of other apps — Android always
  routes uninstall through a system confirmation dialog
  (`Intent.ACTION_DELETE`), which is the correct, honest UX and also what
  Play Store policy requires.

Being upfront about this in the UI (rather than over-promising "boost your
phone by 10x") is a deliberate product/trust decision, not a limitation to
hide.

## 2. Target user & core jobs-to-be-done

- "My phone says storage is full, what's taking it up?"
- "I have hundreds of near-duplicate photos from burst mode, help me
  clean them up without me tapping through the gallery for an hour."
- "What apps am I not using anymore?"
- "What are the biggest files that are safe to move to the cloud/delete?"

## 3. Feature set (v1)

| Feature | What it does | Key APIs |
|---|---|---|
| **Storage dashboard** | Ring chart of used/free space, category breakdown (photos, videos, apps, other), one-tap entry to each cleaner | `StatFs`, `StorageStatsManager` |
| **Duplicate & similar photo/video finder** | Groups exact duplicates (content hash) and near-duplicate bursts (perceptual hash + timestamp/location proximity); keep-best suggestion, swipe/multi-select delete | `MediaStore.Images/Video`, `MessageDigest`, average-hash |
| **Large & old files** | Sorted list of biggest files across photos/videos/downloads, filter by "not opened in 6+ months" | `MediaStore.Files`, `dateAdded`/`dateModified` |
| **App manager** | Installed apps sorted by size / last-used, one-tap uninstall (system dialog), "unused apps" surfaced first | `PackageManager`, `StorageStatsManager`, `UsageStatsManager` |
| **Junk cleaner** | Clears this app's + opt-in scan of orphaned thumbnails, `.tmp`/`.log`/leftover installer `.apk` files the user selects | `Context.cacheDir`, `MediaStore.Files` |
| **Scheduled/auto scan (Pro)** | Weekly background scan via `WorkManager`, notification summary | `WorkManager` |

Out of scope for v1: rooted/system cleaning, RAM "boosting" (mostly
placebo on modern Android and actively discouraged), antivirus.

## 4. Screens / navigation

```
Dashboard (home)
 ├─ Duplicate & Similar Photos  → Review groups → Multi-select delete → Confirm (system dialog)
 ├─ Large & Old Files           → Filter/sort → Multi-select delete
 ├─ App Manager                 → Sort (size/last used) → Uninstall (system dialog)
 ├─ Junk Cleaner                → Category breakdown → Select → Delete
 └─ Settings                    → Permissions status, auto-scan (Pro), theme, about/privacy
```

Each scanner screen follows the same pattern: **Scan → Review (grouped,
pre-selected safe defaults) → Confirm → Result summary ("Freed 1.2 GB")**.
Nothing is ever deleted without an explicit review step.

## 5. Architecture

- **Language/UI:** Kotlin, Jetpack Compose, Material 3.
- **Pattern:** MVVM — Composable screens observe `StateFlow` exposed by
  per-feature `ViewModel`s; scanners run on `Dispatchers.IO` via
  coroutines.
- **DI:** a small manual `AppContainer` (no Hilt) — keeps the scaffold
  buildable without extra annotation-processor setup; swap for Hilt later
  if the codebase grows.
- **No backend/server for v1.** All scanning and hashing happens on-device;
  nothing about a user's files or photos is ever uploaded. This is both a
  privacy commitment and the honest technical reality (there's nothing a
  server could usefully do for local file scanning). A backend only enters
  the picture for Pro entitlement/receipt validation (see §7).

```
ui/            Compose screens + ViewModels (one package per feature)
domain/        Pure Kotlin models (MediaFile, DuplicateGroup, AppInfo, JunkItem)
data/scanner/  MediaScanner, AppInventoryScanner, JunkScanner (talk to Android APIs)
data/delete/   MediaDeleteHelper (handles the API 29/30+ consent-delete flow)
core/          AppContainer (DI), permission helpers
```

## 6. Permissions model

| Permission | Type | Used for | Degrade gracefully if denied |
|---|---|---|---|
| `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` (33+) or `READ_EXTERNAL_STORAGE` (≤32) | Runtime | Scan photos/videos | Show "grant access" prompt on affected screens only |
| `PACKAGE_USAGE_STATS` | Special (Settings redirect) | App size + last-used | App Manager still lists apps/sizes where obtainable; hides "last used" sort |
| `QUERY_ALL_PACKAGES` | Manifest (Play policy: allowed for "device/file management" category apps) | List all installed apps, not just visible ones | — |
| `REQUEST_DELETE_PACKAGES` | Manifest | Smooth uninstall flow | System uninstall dialog still works without it |

Nothing is a blanket "give me all permissions on launch" — each screen
requests only what it needs, when the user opens it.

## 7. Monetization (SaaS angle)

Given the repo's purpose, the natural "SaaS" surface is a **Free vs Pro**
subscription via Play Billing, not a web backend:
- Free: manual scans across all features, ads on result screens.
- Pro (monthly/annual): scheduled auto-scans, ad-free, unlimited duplicate
  group resolution per session (free tier caps at e.g. 3 groups/day),
  priority large-file insights.
- Optional companion **web dashboard** (out of scope for v1) for viewing
  historical "space freed" stats across devices — would need a thin backend
  (auth + entitlement sync) if this repo grows toward being an actual SaaS.

## 8. Build phases

1. **v1 (this scaffold):** Dashboard, Duplicate Finder, Large Files, App
   Manager, Junk Cleaner — all functional against real device APIs.
2. **v1.1:** Perceptual-hash "similar" grouping (not just exact
   duplicates), swipe-to-review UX.
3. **v1.2:** WorkManager scheduled scans + notifications, Play Billing Pro
   tier.
4. **v2:** Optional web dashboard/backend for cross-device stats.

## 9. What's scaffolded in this repo right now

A buildable Android Studio project (`app/`) with the package/module layout
above, working Compose navigation between all five screens, and real
(not stubbed) scanning logic for duplicates (MD5-based), large files,
installed apps, and own-app cache. See `app/README.md` for how to open and
run it, and its noted limitation: this sandbox has no Android SDK, so the
Gradle build has not been compiled here — review in Android Studio first.
