# RiskPilot

Risk-first trading tool: **calculate → check → trade → journal → analyze**.
Position size & risk calculators, trade journal, analytics, daily/weekly guardrails,
pre-trade checklist, multiple accounts, freemium plans and a Pine Script risk tool.
Not a signal service, not advice — calculations and record-keeping only.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma + PostgreSQL · Auth.js v5 · Recharts · Zod · Vitest.

## Run it

```bash
npm install
cp .env.example .env        # set DATABASE_URL and AUTH_SECRET
npx prisma migrate deploy   # or: npm run db:migrate
npm run db:seed             # demo data (fictional)
npm run dev                 # http://localhost:3000
npm test                    # calculation-engine tests
```

Demo login: `demo@riskpilot.app` / `Passw0rd!` (Pro plan, 2 accounts, ~70 fictional trades).

## Layout

- `src/lib/engine/` — pure calculation engine (risk, analytics, guardrail, time). No React, no I/O.
- `src/lib/payments/` — payment abstraction (`mock`, `paystack`; add more in `index.ts`).
- `src/lib/storage/` — file-storage abstraction (`local`; add S3/R2/Supabase adapters).
- `src/config/plans.ts` — plan limits and prices (USD + NGN). Change pricing here.
- `src/actions/` — server actions (every query is scoped by `userId`).
- `src/lib/pine.ts` — Pine Script v5 generator (visualisation only, no signals).

## Position-size formula

```
riskAmount   = balance × risk% / 100
stopDistance = |entry − stop|
lossPerLot   = (stopDistance / tickSize) × tickValue × fxRate
lots         = floor_to_lot_step(riskAmount / lossPerLot)   (never rounds up)
```
Results are tagged **Estimated** until the user confirms the contract spec with their broker.

## Integrations & operations

| Feature | How it works | Config |
|---|---|---|
| **CSV import** | Journal → Import CSV. Reads RiskPilot exports and MT5 position reports (duplicate `Time`/`Price` headers handled). Previews first, skips rows without a stop loss, dedupes by ticket (or a hash), respects plan limits. Risk is *estimated* from presets when the file has no risk amount, and flagged as such. | – |
| **Paystack** | Checkout + `POST /api/webhooks/paystack` (HMAC-SHA512 verified on the raw body, amount/currency checked against our payment row, idempotent + atomic activation). Reusable card authorizations are saved for renewals. | `PAYMENT_PROVIDER=paystack`, `PAYMENT_API_KEY=<secret key>`. In the Paystack dashboard set the webhook URL to `<APP_URL>/api/webhooks/paystack`. |
| **Renewals** | `GET /api/cron/renewals` (daily, `vercel.json`). Charges saved authorizations ≤1 day before expiry, retries every 12 h for 3 days, then expires. Users can turn auto-renew off in Plan & billing. | `CRON_SECRET` (Bearer token; endpoints return 503 if unset) |
| **S3 / R2 storage** | One S3-compatible adapter (AWS S3, Cloudflare R2, MinIO…). Screenshots are served only through an ownership-checked route. | `STORAGE_PROVIDER=s3\|r2`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_ENDPOINT` (required for R2), optional `STORAGE_REGION` |
| **Telegram** | Settings → Connect Telegram (one-time 15-min code). Alerts when you near/reach *your own* limits (once per day per level), open-trade reminders, Monday recap, Pro-expiry nudges; `/status`, `/stop`. Messages never mention buying or selling. | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`. Register: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/webhook&secret_token=<SECRET>`. `GET /api/cron/reminders` runs daily. |
| **Prop-firm rules** | Risk Rules → templates (generic, editable): max total drawdown (fixed or trailing), profit target, daily/weekly limits. A breached drawdown turns the guardrail to STOP and triggers a Telegram alert. | Pro feature |

Tests: `npm test` (unit tests need nothing; integration tests use `TEST_DATABASE_URL` — run `DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy` once).

## Indicator Lab & Marketplace

**Honest scope:** RiskPilot cannot execute Pine Script (no runtime exists outside TradingView) and has no market-data feed.
So the Lab stores/parses Pine *as text* (version, inputs — never executed) and backtests **explicit rules** you define
(entries, exits, stop, target, sizing) on candle CSVs you upload. TradingView Strategy Tester trade lists can be imported for
analysis (shown as *imported, unverified*). Synthetic demo data exists for learning and is flagged everywhere; it can never be marketplace evidence.

| Area | What it does |
|---|---|
| Indicators | Name, description, markets, timeframes, version history, change log, compatibility, Private / Unlisted / Public. Metadata and private source are separate tables; source is only ever read by the owner (or an audited admin review). |
| Strategies | Separate from indicators. Rule builder (EMA/SMA/RSI/ATR/Donchian, crosses/levels), stop & target types, session filter, `$parameters`. |
| Backtests | No look-ahead (signal at close → fill at next open), spread, slippage, commission, risk-first lot sizing, stop-first when both touched. Full report + session / hour / weekday / direction / month analysis. |
| Parameter tests | Grid (≤60 combos), never ranked or labelled "best", with the overfitting warning. Pro. |
| Walk-forward | Fixed parameters on separate in-sample and out-of-sample periods, stored as separate runs. Pro. |
| Marketplace | Browse/search/filters, listings with history/docs/screenshots, free · one-time · monthly · yearly, reviews (access required, creators can't review themselves), reports, compare (no ranking). |
| Licensing | Protected by default; "source included" is an explicit creator choice. Update policy per product. TradingView invite-only delivery workflow. Buyers can test a creator's strategy in the Lab without seeing its rules. |
| Money | Integer cents. Commission, fees, tax, holdback, price limits, NGN rate are **platform settings** (admin UI). Orders snapshot the terms. Ledger-derived creator balances, payouts (manual provider behind an interface), refunds with provider call + clawback. |
| Admin | `/admin` (404 for non-admins; every function re-checks the role): listings review, creators, reports, refunds, payouts, settings, categories, audit log. Make an admin: `npm run make-admin -- you@example.com`. |

Demo logins (password `Passw0rd!`): `demo@riskpilot.app` (Pro trader), `admin@riskpilot.app`, `ada@creators.demo`, `chidi@creators.demo`, `tunde@creators.demo`.
`APP_ENCRYPTION_KEY` (base64, 32 bytes) encrypts payout details in production.
