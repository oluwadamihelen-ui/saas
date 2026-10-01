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
