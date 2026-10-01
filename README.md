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
