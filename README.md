# StayOS

A multi-property hotel management system: reservations, front desk
(check-in/check-out, walk-ins), rooms and housekeeping, guest folios and
payments, maintenance, expenses, and operational reporting — with every
hotel's data fully isolated from every other hotel's.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system design.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · PostgreSQL + Prisma ·
Auth.js v5 · BullMQ + Redis · Zod

## Getting started

Requirements: Node 20+, PostgreSQL (with the `btree_gist` extension
available — it's part of the standard `postgresql-contrib` package), Redis.

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, REDIS_URL, AUTH_SECRET
npx prisma migrate dev
npm run db:seed
npm run dev                # http://localhost:3000
```

In a second terminal, run the worker process (schedules a daily sweep for
arrival/departure reminders, stale-balance alerts, and auto no-show
flagging):

```bash
npm run worker
```

### Demo accounts

All seeded with password `Passw0rd!`:

| Role | Email | Hotel |
|---|---|---|
| Super Admin | admin@stayos.example | — (platform-wide) |
| Hotel Owner | owner@sunrisehotel.example | Sunrise Hotel (Lagos, NGN) |
| Hotel Manager | manager@sunrisehotel.example | Sunrise Hotel |
| Receptionist | reception@sunrisehotel.example | Sunrise Hotel |
| Accountant | accounts@sunrisehotel.example | Sunrise Hotel |
| Housekeeping | housekeeping@sunrisehotel.example | Sunrise Hotel |
| Maintenance | maintenance@sunrisehotel.example | Sunrise Hotel |
| Hotel Owner | owner@oceanviewhotel.example | Ocean View Hotel (Cape Town, ZAR) |
| Hotel Owner | owner@royalsuites.example | Royal Suites (New York, USD) |

Each hotel has the same staff roles seeded under its own domain (e.g.
`manager@oceanviewhotel.example`). Sign in as two different hotels' owners
side by side to see that neither can see the other's reservations, guests,
rooms, or payments.

### The core workflow

1. **A hotel signs up** at `/register` — this creates the `Hotel` row and its
   first `HOTEL_OWNER` user in one transaction (`createHotelWithOwner`,
   `lib/services/hotels.ts`).
2. **The owner sets up rooms**: room types (Standard, Deluxe, Suite — price,
   capacity, amenities) under Room Types, then individual rooms under Rooms.
3. **A reservation is created** — either through Reservations → New (any
   source: online, phone, corporate, travel agent) or Front Desk → New
   Walk-in (search availability → pick a room → guest details → optional
   payment → optional immediate check-in, all as one operation).
   Availability search and reservation creation both go through the same
   overlap check (`lib/services/availability.ts`), and the database itself
   enforces it with a Postgres `EXCLUDE` constraint on `Reservation` — see
   ARCHITECTURE.md §3.
4. **Check-in** moves the reservation to `CHECKED_IN` and the room to
   `OCCUPIED`. Charges (room service, laundry, mini bar, ...) can be added to
   the stay at any point.
5. **Check-out** optionally takes a final payment, requires the balance to be
   settled (or an explicit override), generates a PDF-ready invoice from the
   guest's folio, moves the room to `DIRTY`, and creates a housekeeping task.
6. **Housekeeping** works the room through
   `Dirty → Cleaning → Inspected → Available`; a failed inspection sends it
   back to `Dirty`.
7. **Reports** (occupancy, revenue, room performance, guest statistics,
   expenses, outstanding balances) are computed live from the database for
   Today / This Week / This Month / a custom range.

## Scripts

```bash
npm run dev              # start the app
npm run worker           # daily operations sweep (BullMQ)
npm run build             # production build
npm run lint               # eslint
npm test                   # vitest — unit tests + DB-backed integration tests
                            # (tests/integration/*, incl. double-booking
                            # prevention and cross-hotel isolation), run
                            # against the same local Postgres as `npm run dev`
npm run db:seed            # (re)seed the database — three hotels, full staff
                            # rosters, rooms, guests, and a realistic mix of
                            # reservation lifecycles
```
