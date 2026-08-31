# MAMA Business OS

**The business OS built for Africa.** A WhatsApp-first Business Operating System that helps
merchants sell, manage customers, track orders, control inventory, accept payments, and
use AI to run their business — built starting with **Mama Foodstuff**, a realistic demo
grocery business.

> MAMA is not a marketplace. It's the operating system merchants run their business on.

---

## 1. Architecture summary

- **Frontend/Backend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, hand-built
  shadcn/ui-style components (`src/components/ui`). API routes live under `src/app/api/**`.
- **Database**: PostgreSQL via Prisma ORM (`prisma/schema.prisma`).
- **Auth**: Auth.js (NextAuth v5) — email/password (bcrypt) + optional Google OAuth, JWT
  sessions. Split into an edge-safe config (`src/lib/auth.config.ts`, used by middleware)
  and the full Node config (`src/lib/auth.ts`, used everywhere else) because Prisma cannot
  run on the Edge runtime.
- **Multi-tenancy**: every business is a tenant. `src/lib/tenant.ts` is the single
  choke point (`requireBusinessMembership`) that every API route calls before touching
  business-owned data — it never trusts a `businessId` from the client beyond using it to
  look up a membership row for the *authenticated* user.
- **Payments**: Paystack (`src/lib/payments/paystack.ts`) — initialize transaction, verify
  server-side, and a signed webhook handler with idempotency.
- **WhatsApp**: Official Meta WhatsApp Cloud API only (`src/lib/whatsapp/*`) — no
  unofficial automation. A small conversation state machine (`src/lib/whatsapp/flow.ts`)
  implements the shop → cart → checkout journey via interactive list/button messages.
- **AI**: A provider abstraction (`src/lib/ai/provider.ts`) with a real Anthropic
  implementation and a deterministic "mock" fallback used when no API key is configured —
  both only ever answer from a shared tool registry (`src/lib/ai/tools.ts`) that queries
  the current business's real data. Destructive tools require explicit user confirmation.
- **Multi-tenant SaaS extras**: subscription plans stored in the DB (not hard-coded),
  a public storefront per business (`/shop/[slug]`), an admin dashboard (`/admin`), and an
  audit log / webhook event log for observability.

### Project structure

```
prisma/
  schema.prisma        All data models (see §3)
  seed.ts               Seeds Plans, an admin user, and the Mama Foodstuff demo business
src/
  app/
    (marketing) page.tsx, /login, /register        Public pages
    onboarding/                                     7-step merchant onboarding wizard
    dashboard/                                       Merchant-facing app (auth-gated)
    admin/                                            Platform admin (role-gated)
    shop/[slug]/                                      Public storefront + checkout
    api/                                              All API routes (REST-ish, typed)
  components/
    ui/                 Hand-built shadcn-style primitives (Button, Card, Dialog, …)
    dashboard/          Feature UI (products, orders, customers, AI chat, …)
    storefront/         Public storefront UI
  lib/
    auth.ts / auth.config.ts   NextAuth setup (Node / Edge split)
    tenant.ts / errors.ts       Tenant isolation + shared error type
    prisma.ts                   Prisma client singleton
    orders.ts                   Shared order-creation & payment-confirmation logic
    payments/paystack.ts        Paystack integration
    whatsapp/                   WhatsApp Cloud API client + conversation flow
    ai/                         AI provider abstraction + tool registry + chat loop
    analytics/                  All analytics/reporting queries (shared by dashboard + AI)
    subscription.ts             Plan-limit enforcement
    plans.ts                    Canonical plan/pricing definitions
tests/                  Vitest suite (tenant isolation, orders, payments, AI tools, auth)
```

---

## 2. The core end-to-end loop (what actually works today)

This is the flow the whole system is built around, and it works end-to-end against a
real database:

1. Merchant registers → creates a business → adds a product (onboarding wizard).
2. Merchant connects WhatsApp (Cloud API credentials) and Paystack (public/secret key).
3. A customer messages the business's WhatsApp number → Mama greets them → they browse
   categories → pick a product → add to cart → check out (name + address) → an `Order`
   is created and a Paystack payment link is generated and sent back over WhatsApp.
   (The same flow exists on the public storefront at `/shop/[slug]` with a normal cart UI.)
4. Customer pays. **The frontend/redirect is never trusted.** The Paystack webhook
   (`/api/payments/webhook`) verifies the HMAC-SHA512 signature, checks the transaction
   status, and only then calls `markOrderPaid()`, which — in one transaction — marks the
   order paid, decrements stock, and writes an inventory movement. This is idempotent via
   a `(source, externalId)` unique constraint on `WebhookEvent`.
5. The merchant sees the order in `/dashboard/orders` and a notification is created.
6. The merchant asks Mama AI *"How much did I sell today?"* — the AI calls the
   `get_today_sales` tool, which queries `Order`/`Payment` scoped to that business, and
   answers with the real number.

---

## 3. Database schema

All models live in `prisma/schema.prisma`. Highlights:

- **Identity**: `User`, `Account`/`Session`/`VerificationToken` (NextAuth adapter tables),
  `Business` (the tenant), `BusinessMember` (user ↔ business, with `OWNER`/`ADMIN`/`STAFF`).
- **Catalog**: `Product`, `ProductCategory`, `ProductImage`, `InventoryMovement`.
- **CRM**: `Customer`, `CustomerTag`, `CustomerSegment`.
- **Commerce**: `Order`, `OrderItem`, `Payment`, `PaymentSettings`.
- **WhatsApp**: `WhatsAppAccount`, `WhatsAppContact`, `Conversation`,
  `ConversationMessage`, `WhatsAppTemplate`.
- **Marketing**: `Campaign`, `CampaignRecipient`, `MarketingSettings`.
- **AI**: `AISession`, `AIConversation`, `AIMessage` (full tool-call transcript, so every
  AI answer is auditable).
- **Platform**: `Plan`, `Subscription`, `Notification`, `WebhookEvent`, `AuditLog`,
  `BusinessSettings`, `AnalyticsEvent`.

Nearly every business-owned table carries a `businessId` foreign key + index, which is
what makes server-side tenant isolation possible (see §5).

---

## 4. API overview

All routes under `/api/**` are typed with Zod and enforce auth + tenant membership except
the explicitly public ones (customer-facing checkout, webhooks).

| Route | Method | Notes |
|---|---|---|
| `/api/auth/register` | POST | Create account (bcrypt-hashed password) |
| `/api/auth/[...nextauth]` | * | NextAuth handlers (credentials + Google) |
| `/api/business` | GET/POST | List / create businesses for the current user |
| `/api/products`, `/api/products/[id]` | GET/POST/PATCH/DELETE | Tenant-scoped, plan-limited |
| `/api/inventory/adjust` | POST | Stock adjustments → `InventoryMovement` |
| `/api/orders`, `/api/orders/[id]` | GET/POST/PATCH | Order creation & status updates |
| `/api/customers`, `/api/customers/[id]` | GET/PATCH | CRM |
| `/api/payments/create` | POST | **Public** — starts a Paystack transaction for an order |
| `/api/payments/webhook` | POST | **Public**, Paystack-signed — the source of truth for "paid" |
| `/api/payments/verify` | GET | Best-effort re-verify on the storefront return page |
| `/api/payments/dev-simulate` | POST | Dev-only fallback when Paystack isn't connected (see §11) |
| `/api/whatsapp/account` | GET/POST | Connect a business's WhatsApp Cloud API credentials |
| `/api/whatsapp/webhook` | GET/POST | **Public** — Meta verification + inbound message handling |
| `/api/ai/chat` | POST | Mama AI chat turn (tool-calling loop) |
| `/api/ai/confirm` | POST | Approve/cancel a destructive AI tool call |
| `/api/campaigns`, `/api/campaigns/[id]/send` | GET/POST | Marketing campaigns |
| `/api/storefront/orders` | POST | **Public** — storefront checkout (no MAMA account needed) |
| `/api/subscription` | POST | Change plan (see §11 re: no real billing yet) |
| `/api/wallet` | GET | Balance + ledger for a wallet-mode business |
| `/api/wallet/bank-account` | GET/POST | Add + verify a payout bank account (platform key, no merchant Paystack needed) |
| `/api/wallet/withdraw` | POST | Request a payout to the saved bank account |
| `/api/wallet/pay-order` | POST | Pay another merchant's order using the caller's own wallet balance |
| `/api/admin/businesses/[id]/suspend` | POST | Admin-only |

---

## 5. Authentication & tenant isolation

- Passwords are hashed with bcrypt (cost 12); NextAuth issues JWT sessions.
- `middleware.ts` protects `/dashboard`, `/onboarding`, and `/admin` at the edge using a
  shared `authorized()` callback, so route protection can't drift between the edge config
  and the full config.
- Every API route that touches business data calls
  `requireBusinessMembership(businessId)` (`src/lib/tenant.ts`) first. It:
  1. Requires a valid session (401 if not).
  2. Rejects suspended accounts (403).
  3. Looks up a `BusinessMember` row for `(businessId, userId)` — if none exists, it
     returns **404 "Business not found"**, not 403, so this endpoint can't be used to
     enumerate which business IDs exist.
- The Mama AI tool layer never accepts a `businessId` from the model or the request body
  — the chat route resolves and verifies it once, then passes it straight into every tool
  call.
- **Automated tests** (`tests/tenant-isolation.test.ts`) explicitly assert that Merchant A
  cannot read Merchant B's business, and that scoped queries never leak another tenant's
  rows.

---

## 6. WhatsApp setup (Meta Cloud API)

1. Create a Meta app at [developers.facebook.com](https://developers.facebook.com/) and
   add the **WhatsApp** product.
2. From **API Setup**, note your **Phone Number ID** and **WhatsApp Business Account ID**,
   and generate a temporary (or System User) **access token**.
3. In MAMA, go to **Dashboard → WhatsApp** (or the onboarding "Connect WhatsApp" step) and
   enter those three values. They're encrypted at rest (`src/lib/crypto.ts`, AES-256-GCM).
4. In Meta's app dashboard, configure the webhook:
   - Callback URL: `https://<your-domain>/api/whatsapp/webhook`
   - Verify token: whatever you set as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to the `messages` field.
5. (Recommended) Set `WHATSAPP_APP_SECRET` so inbound webhook requests are verified via
   `X-Hub-Signature-256`. Without it, verification is skipped — fine for local dev, not
   for production.

Message templates for outbound marketing outside the 24-hour customer service window must
be created and approved in Meta Business Manager — MAMA's campaign sender currently sends
free-form text (works within the 24h window); see §11.

### Alternative: connect via Twilio instead of Meta directly

Setting up your own Meta Business Portfolio can hit account-specific walls (portfolio
creation limits, business verification, phone-OTP loops) that have nothing to do with
MAMA. As a Meta-certified WhatsApp Business Solution Provider, **Twilio** is a legitimate
"official platform" alternative that sidesteps all of that — sign up at
[twilio.com](https://twilio.com), open their free WhatsApp Sandbox, and:

1. In **Dashboard → WhatsApp**, set **Provider** to **Twilio**.
2. Enter the **Twilio WhatsApp number** (the sandbox number, e.g. `+14155238886`), your
   **Account SID**, and your **Auth Token** (all from the Twilio Console).
3. In Twilio's console, set the Sandbox/Sender's inbound webhook to
   `https://<your-domain>/api/whatsapp/webhook` (same URL as Meta — the route
   auto-detects which provider sent the request by payload shape).
4. From your own WhatsApp, send the sandbox's join code to link your number as a test
   recipient, then message it — it should flow straight into MAMA's conversation list.

**Trade-off:** Twilio's API has no equivalent of Meta's tappable interactive
buttons/lists without pre-approved Content Templates, so the shopping flow renders
menus as numbered plain text over Twilio (see `renderOptionsAsText` in
`lib/whatsapp/client.ts`) and customers reply with a number or the option's name
instead of tapping — `lib/whatsapp/flow.ts`'s `resolveTextShortcut` handles matching
that back to the right category/product. Everything else (orders, payments, inventory)
behaves identically regardless of provider.

---

## 7. Paystack setup

1. Get your keys from **Paystack Dashboard → Settings → API Keys & Webhooks**.
2. Enter them in **Dashboard → Payments** (or during onboarding). They're stored encrypted
   per business; `PAYSTACK_SECRET_KEY`/`PAYSTACK_PUBLIC_KEY` in `.env` act as a
   platform-level fallback (used by the seeded demo business, which has no real keys).
3. Add your webhook URL in the Paystack dashboard: `https://<your-domain>/api/payments/webhook`.
4. Every webhook is signature-verified (HMAC-SHA512) against the *business's* secret key
   before anything is written, and idempotent via a unique `(source, externalId)`
   constraint — replays and duplicate deliveries are no-ops.

### Merchant wallets — for businesses without their own Paystack account

Paystack requires CAC business registration to sign up, which locks out a lot of small
merchants this product is meant to serve. Any business that hasn't connected its own
Paystack account is automatically in **wallet mode**: customer payments are collected into
**MAMA's own platform Paystack account** (`PAYSTACK_SECRET_KEY`), and each business's share
is tracked as an internal balance (`Wallet`/`WalletTransaction` in the schema) rather than
settled to them directly by Paystack.

- **Getting paid out**: a merchant adds a payout bank account from **Dashboard → Wallet**.
  This never requires *their own* Paystack account — MAMA's platform key calls Paystack's
  bank-lookup API to confirm the account is real (and whose name it's under) and creates a
  Transfer Recipient, entirely on the platform's side. Withdrawal requests then call
  Paystack's Transfers API the same way, debiting the wallet immediately and reconciling
  against `transfer.success` / `transfer.failed` / `transfer.reversed` webhooks (same
  endpoint as charge webhooks, verified against the platform key instead of a business's).
- **Paying another merchant with wallet balance**: on any business's storefront
  (`/shop/[slug]`), a merchant logged into their *own* MAMA account sees a "Pay with wallet
  balance" option at checkout if they have enough balance. No real money moves — it's a
  same-transaction re-attribution between the two wallets (`lib/wallet.ts`,
  `transferBetweenWallets`). Anonymous customers never see this; a wallet belongs to a
  business, not a one-off shopper.
- **Ledger correctness**: `Wallet.balance` is a cached total that must always equal the sum
  of `WalletTransaction` rows — every credit/debit writes both in one DB transaction
  (`lib/wallet.ts`). Debits use a conditional `UPDATE ... WHERE balance >= amount` rather
  than read-then-write, so two concurrent withdrawal requests can never both succeed against
  a balance that only covers one (covered by `tests/wallet.test.ts`).

**Payout security (`lib/wallet-security.ts`)** — a pooled wallet means the platform key can
move real money on a merchant's behalf, so adding or changing *where* it goes is treated as
a high-risk action, not a normal settings edit:

- **Owner-only**: only a business's `OWNER` can add/change the payout bank account or request
  a withdrawal — `ADMIN`/`STAFF` members can view the wallet but not move money out of it.
- **Password re-confirmation**: both actions require the acting user to re-enter their current
  account password (`requireCurrentPassword`, bcrypt-checked against `User.passwordHash`), so
  a hijacked session or an unattended logged-in browser isn't enough on its own. Accounts with
  no password (Google-only sign-in) are blocked from these actions until one is set.
- **24-hour withdrawal lock on change**: adding or changing the payout bank account sets
  `BankAccount.lockedUntil` to 24h out; withdrawals are refused until it passes
  (`computeLockedUntil`). This gives the real owner a window to notice and react to a change
  that wasn't theirs before any money can actually leave.
- **Audit trail + alerts**: every add/change/withdrawal writes an `AuditLog` row and creates a
  `SECURITY_ALERT` notification for the business (`logWalletSecurityEvent`), so there's always
  a record and an in-app nudge if something looks wrong.
- **Name-match warning**: the account name Paystack resolves for a new/changed bank account is
  loosely compared against the business's owner/business name (`accountNameLikelyMatches`). A
  mismatch is surfaced as a warning, not a hard block — merchants legitimately withdraw to a
  partner's or relative's account sometimes — but it's a visible signal to double-check.

**Regulatory note, stated plainly:** pooling third-party funds in one account and moving
them between merchants or out to bank accounts is what makes a platform a payment service
provider under Nigerian law, which typically requires a CBN license (or a licensed partner
underneath). This is modeled correctly as software; it does not make the arrangement itself
compliant — that's a legal decision, not a code one.

---

## 8. Mama AI setup

- **No key needed to try it.** With `AI_PROVIDER=mock` (the default), Mama AI still only
  answers from real data — it uses keyword matching to pick the right tool
  (`src/lib/ai/provider.ts`) instead of an LLM, then reports the tool's actual output. It
  will never invent a number.
- **To use a real model**, set:
  ```
  AI_PROVIDER=anthropic
  AI_API_KEY=sk-ant-...
  AI_MODEL=claude-sonnet-5
  ```
  This calls the Anthropic Messages API directly with the tool registry from
  `src/lib/ai/tools.ts` (`get_today_sales`, `get_top_products`, `get_low_stock_products`,
  `generate_marketing_message`, `delete_product`, …). The provider interface
  (`AIProvider`) makes it straightforward to add another provider later.
- Tools that modify data (`delete_product`, `create_customer_segment`) are marked
  `destructive: true` and are never auto-executed — the chat route returns a
  confirmation card instead, and only runs the tool after the merchant clicks Confirm
  (`/api/ai/confirm`).

---

## 9. Environment variables

See `.env.example` for the full list with comments. Copy it to `.env` and fill in what
you have — everything not required for local dev has a safe default or graceful fallback.

---

## 10. Local development

```bash
npm install

# Postgres running locally (or point DATABASE_URL at Neon/Supabase/Railway)
cp .env.example .env   # then edit DATABASE_URL, AUTH_SECRET, etc.

npx prisma migrate dev     # create the schema
npm run db:seed            # seed Plans + admin user + Mama Foodstuff demo data

npm run dev                # http://localhost:3000
```

**Demo logins** (created by the seed script):

- Merchant: `demo@mamabusiness.com` / `Demo12345!` (business: **Mama Foodstuff**)
- Admin: `admin@mamabusiness.com` / `Admin12345!` (visit `/admin`)

Public storefront for the demo business: `http://localhost:3000/shop/mama-foodstuff`.

### Other commands

```bash
npm run build       # production build (also runs TypeScript checks)
npm run start        # run the production build
npm run lint          # ESLint
npm test               # Vitest suite (spins up against a separate test DB, see below)
```

---

## 11. Known limitations (read before demoing or shipping)

Being upfront about what's real vs. simplified, per the "don't fake an integration"
principle this project was built under:

- **WhatsApp Embedded Signup isn't implemented.** Merchants paste their Phone Number ID /
  WABA ID / access token manually (the standard non-embedded Cloud API setup) rather than
  going through Meta's OAuth-based embedded signup flow.
- **WhatsApp campaign sending uses free-form messages**, not pre-approved templates. This
  only works within Meta's 24-hour customer service window. Sending outside that window
  requires an approved `WhatsAppTemplate`, which this MVP models in the schema but doesn't
  yet submit/manage through the Meta API.
- **Subscription plan changes are unbilled.** `/api/subscription` switches a business's
  plan immediately; it doesn't charge anything via Paystack. Real recurring billing would
  build on the existing Paystack integration (subscriptions/plans API) but is out of scope
  for this MVP.
- **`/api/payments/dev-simulate`** exists purely so the full order→payment→inventory loop
  can be demoed without live Paystack credentials. It's hard-disabled in production
  (`NODE_ENV=production`) and refuses to run at all if the business has a real Paystack
  key connected — it never silently substitutes for the real integration.
- **The Mama AI "mock" provider** is a deliberate, honest fallback (see §8) — it is not a
  real language model, just deterministic keyword routing over the same tool registry a
  real model would use.
- **Multi-merchant Marketplace, delivery/logistics, and a public developer API** are
  intentionally not built — the schema and tenant model are designed so they can be added
  later without a rewrite, per the product brief's phased scope.
- **Single-instance rate limiting** (`src/lib/api-helpers.ts`) is in-memory — fine for one
  server, not for a multi-instance deployment (swap for Redis/Upstash there).

---

## 12. Testing

```bash
createdb mama_business_test   # one-time; or point .env.test at another DB
DATABASE_URL=... npx prisma migrate deploy   # apply migrations to the test DB
npm test
```

`tests/setup.ts` loads `.env.test` before anything imports the Prisma client, so the
suite never touches your dev/seed data. Coverage includes:

- **Tenant isolation** — a merchant cannot read another merchant's business, products, or
  data; scoped queries never leak cross-tenant rows.
- **Auth** — password hashing/verification, registration validation & duplicate-email
  rejection.
- **Orders & inventory** — stock isn't touched until payment is confirmed; `markOrderPaid`
  decrements stock and writes an inventory movement exactly once even if called twice
  (idempotency); repeat customers are upserted by phone, not duplicated.
- **Payments** — Paystack webhook HMAC-SHA512 signature verification (valid, tampered,
  wrong-secret, missing-signature cases).
- **Subscription limits** — the Free plan's product cap is enforced.
- **AI tool scoping** — tools only ever return the calling business's data; destructive
  tools are correctly flagged and can't be tricked into touching another tenant's data.

---

## 13. Deployment

- **App**: [Vercel](https://vercel.com) (Next.js-native). Set all variables from
  `.env.example` in the project's Environment Variables settings.
- **Database**: any managed Postgres — [Neon](https://neon.tech),
  [Supabase](https://supabase.com), or [Railway](https://railway.app) all work with
  Prisma out of the box. Run `npx prisma migrate deploy` against production as part of
  your deploy step (not `migrate dev`).
- **Paystack**: switch to live keys, and update the webhook URL in the Paystack dashboard
  to your production domain.
- **WhatsApp**: move from a temporary access token to a permanent System User token, and
  update the Meta webhook URL/verify token for production.
- Set `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` to your real domain (both are used to build
  callback/webhook URLs).

---

## 14. Recommended Phase 2 features

In priority order, building on the foundation already in place:

1. WhatsApp Embedded Signup (OAuth-based connect, no manual token copy/paste).
2. Approved WhatsApp message templates + a template submission/management UI.
3. Real Paystack-backed subscription billing (the schema already models `Plan`/`Subscription`).
4. Product variations, multiple images, wholesale pricing, and multi-location inventory
   (the schema was designed with these in mind — see `ProductImage`, `wholesalePrice`).
5. MAMA Marketplace: a discovery layer across verified merchants (the tenant model already
   supports this without a rewrite).
6. MAMA Delivery / logistics integrations.
7. A public MAMA API (developer platform) with API keys and scoped tokens.
8. Real-time notifications (push/SMS/email channels) — the `Notification` model already
   supports adding channels without a schema change.
9. Proactive AI insights delivered on a schedule (a cron job calling the same analytics
   layer the dashboard and chat already share).
