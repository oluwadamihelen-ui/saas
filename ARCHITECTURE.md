# StayOS — Architecture

StayOS is a multi-property hotel management system (a hotel operations
SaaS): reservations, front desk, rooms and housekeeping, guest folios and
payments, maintenance, expenses, and reporting — for independent hotels,
guest houses, and small hotel groups. Every hotel's operational data is
completely isolated from every other hotel's.

## 1. Recommended Architecture

- **Framework**: Next.js 16 (App Router, Turbopack, React Server
  Components) for both frontend and backend (server actions + a small
  number of route handlers). Every domain rule lives in
  `src/lib/services/*`, never inline in a page or action.
- **Database**: PostgreSQL via Prisma ORM (`prisma/schema.prisma`). One
  `Hotel` row per property; nearly every other model carries a `hotelId`
  foreign key.
- **Background jobs**: BullMQ + Redis, for the single recurring job the
  system needs today — the daily operations sweep (§7).
- **Auth**: Auth.js v5, Credentials provider, JWT sessions. A session
  carries the caller's resolved hotel membership (§4), not just their
  identity.
- **Styling**: Tailwind CSS v4 with a small custom design-token layer
  (`src/app/globals.css`) — no component library dependency for visual
  identity, though Radix primitives back a few interactive components.
- **Validation**: Zod schemas at every server action boundary.

## 2. Database Schema

Full schema: `prisma/schema.prisma`. Key clusters:

| Cluster | Models |
|---|---|
| Platform identity | `User`, `Permission`, `RolePermission`, `UserPermission` |
| Hotel & staff | `Hotel`, `HotelMember` |
| Rooms | `RoomType`, `Room`, `RoomStatusLog` |
| Guests & stays | `Guest`, `Reservation`, `RoomTransfer` |
| Billing | `Payment`, `AdditionalCharge`, `Invoice`, `Expense` |
| Operations | `HousekeepingTask`, `MaintenanceRequest` |
| Platform-wide | `Notification`, `AuditLog`, `Setting` |

Design notes:

- **UUID primary keys** everywhere; `createdAt`/`updatedAt` on mutable
  models; indexes on foreign keys and common filter columns (`hotelId` +
  status, `hotelId` + date, phone/email for guest search).
- **`hotelId` on every operational model** is the literal tenant boundary.
  It is never nullable on hotel-scoped models (it *is* nullable on the few
  platform-wide models — `Notification`, `AuditLog`, `Setting` — where a
  row can belong to the platform itself, e.g. a Super Admin action with no
  associated hotel).
- **No global `Role` table.** Platform-level access is a single boolean
  (`User.isSuperAdmin`) — deliberately separate from any hotel's staff, per
  the requirement that the platform Super Admin is not a hotel role.
  Hotel-level access is `HotelMember.role` (a `RoleKey` enum), scoped to one
  `(hotelId, userId)` pair via `@@unique([hotelId, userId])` — the same
  person can hold memberships (and different roles) at more than one hotel,
  which is what lets a hotel *group* owner eventually manage several
  properties without a schema change (§8).
- **Reservation is the financial and operational spine of a stay.** It
  carries the locked-in `roomRate`/`nights`/`subtotal`/`tax` computed at
  booking time (never recomputed from a room type's live price), plus
  running `totalAmount`/`amountPaid`/`balance` that
  `recomputeReservationTotals()` (`lib/services/reservations.ts`)
  recalculates from the live sum of `AdditionalCharge` and completed
  `Payment` rows every time either changes — so the folio is always
  authoritative and never hand-edited out of sync.
- **`Invoice.lineItems` is a JSON snapshot**, not a live view. It's built
  once (at checkout) from the folio at that moment and never silently
  rewritten by a later charge or payment — a correction is an explicit
  `reissueInvoice()` call, audit-logged, not an automatic recompute. This
  mirrors why `OrderItem.unitPrice` is frozen at purchase time in
  transactional systems generally: a historical financial document must
  reflect what was true when it was issued.
- **`RoomTransfer` and `RoomStatusLog` are append-only history tables.**
  Transferring a guest updates `Reservation.roomId` to the new room but
  keeps a permanent record of the original assignment; every room status
  change (automatic or manual override) is logged with who changed it, from
  what, to what, and why.
- **Cancellations and no-shows are status changes, never deletes.**
  `Reservation.status` moves to `CANCELLED` (with `cancellationReason`,
  `cancelledById`, `cancelledAt`) or `NO_SHOW` — the row, and its full
  history, stays.

## 3. Double-Booking Prevention

This is enforced at two layers, deliberately redundant:

1. **Application layer** (`lib/services/availability.ts`): before creating,
   extending, or transferring a reservation, `isRoomAvailable()` checks for
   any other reservation on the same room whose status is `PENDING`,
   `CONFIRMED`, or `CHECKED_IN` (i.e. still holding the room) with an
   overlapping `[checkInDate, checkOutDate)` range. This is what produces a
   clean, friendly validation error ("Room 204 is not available for the
   selected dates") instead of a raw database error.
2. **Database layer** (`prisma/migrations/.../migration.sql`): a Postgres
   `EXCLUDE USING gist` constraint on `Reservation`, over `(roomId WITH =,
   tsrange(checkInDate, checkOutDate, '[)') WITH &&)`, filtered to the same
   three "blocking" statuses. This is the guarantee that actually holds
   under concurrency — two receptionists booking the same room in the same
   instant race at the database, and the loser's `INSERT` fails with a
   Postgres exclusion violation (`23P01`), which the service layer catches
   and turns into the same friendly error.

Every write path that can move a reservation's room or dates —
`createReservation`, `extendStay`, `transferRoom` — goes through both
layers. `searchAvailableRooms()` uses the same overlap definition so a
receptionist is never even offered a room the create step would reject.

## 4. Multi-Hotel Isolation

The mechanism, not just the intent: **`requireHotelUser()`**
(`lib/auth/require.ts`) resolves the caller's active `hotelId` from their
server-side session — never from a client-supplied argument, route param,
or form field. Every hotel-scoped server action and page starts by calling
`requireHotelUser()` or `requirePermission()` (which calls it internally),
and every service function takes `hotelId` as an explicit first argument
that it uses to filter (or scope the `where` of) every query. There is no
code path where a request can name a different hotel's id and reach its
data — `tests/integration/hotel-isolation.test.ts` exercises this directly:
querying Hotel A's services with Hotel B's resource ids returns `null`/empty
results, not Hotel B's data.

A user's session is established at login (`src/auth.ts`): if
`User.isSuperAdmin`, the session has no `hotelId` at all (the Super Admin
console, `/super/*`, requires *not* having a hotel context — see below). If
not, `authorize()` resolves an active `HotelMember` row (preferring the
user's `primaryHotelId`) and puts that hotel's id, name, currency, and the
user's role *at that hotel* into the JWT. A user who belongs to more than
one hotel (a group scenario, §8) can switch active hotel via
`resolveHotelSwitch()` (server-verified against their real `HotelMember`
rows) + `useSession().update()`, without a full re-login.

`src/proxy.ts` (Next.js 16's renamed `middleware.ts`) adds a coarse-grained
guard before any page code runs: `/app/*` requires a session with a
`hotelId` and redirects a Super Admin to `/super`; `/super/*` requires
`isSuperAdmin` and redirects everyone else to `/app`. Page-level
`requirePermission()`/`requireHotelUser()` calls are the actual enforcement
(matching the existing convention that middleware is a UX redirect, not the
authorization boundary).

## 5. Roles & Permissions

`RoleKey`: `SUPER_ADMIN` (platform, not a `HotelMember` role),
`HOTEL_OWNER`, `HOTEL_MANAGER`, `RECEPTIONIST`, `ACCOUNTANT`,
`HOUSEKEEPING`, `MAINTENANCE`, `STAFF`.

`lib/auth/permissions.ts` is the canonical permission catalog
(`reservations.manage`, `checkin.manage`, `payments.manage`, ...) and each
hotel role's default grant set. Unlike a marketplace platform with a single
global `RolePermission` table, a hotel's Owner can override an individual
staff member's permissions **at that hotel specifically**:
`UserPermission` is keyed `(userId, hotelId, permissionId)`, so revoking one
receptionist's ability to manage rooms at Hotel A never touches what that
same person can do if they also work at Hotel B.
`getUserPermissions(userId, hotelId)` (`lib/auth/permissions-resolve.ts`)
resolves role defaults + overrides fresh on every check — deliberately
no next-auth dependency, so it's usable from tests and scripts.

Sidebar navigation (`components/dashboard/nav-items.ts`) is filtered
server-side by the caller's resolved permission set — a receptionist never
even sees a "Staff" or "Settings" link, not just a page that would reject
them.

## 6. Folder Structure

```
prisma/
  schema.prisma                # full data model
  migrations/.../migration.sql # includes the EXCLUDE constraint (§3)
  seed/index.ts                 # three hotels, full staff rosters, rooms,
                                 # guests, and a realistic reservation mix —
                                 # built entirely through the real service
                                 # layer (createReservation, checkIn/Out,
                                 # recordPayment, ...), not hand-crafted rows
src/
  app/
    (auth)/                    # /login, /register (hotel onboarding)
    app/                       # the hotel operations app (/app/*)
      front-desk/               # arrivals/departures/current guests/
                                 # outstanding/no-shows + walk-in flow
      reservations/              # list, new (search + book), detail
                                 # (workflow actions + folio)
      rooms/, room-types/        # room & room-type CRUD, status control
      guests/                    # search, profile, history
      housekeeping/, maintenance/ # task/request boards
      payments/, invoices/, expenses/
      reports/                   # occupancy/revenue/reservations/room
                                 # performance/guest stats/expenses, by
                                 # Today/Week/Month/custom range
      calendar/                  # room x day availability grid
      staff/, settings/, audit-log/, notifications/
    super/                      # platform Super Admin console (/super/*):
                                 # hotels, subscription status/plan,
                                 # platform users, platform settings
    api/
      auth/[...nextauth]/       # Auth.js route handler
      invoices/[id]/pdf/         # auth-checked, hotel-scoped invoice PDF
  auth.ts                       # Auth.js config (Node runtime)
  proxy.ts                      # edge-safe route guard (Next.js 16's
                                 # renamed middleware.ts)
  components/
    ui/                          # design-system primitives
    dashboard/                    # sidebar, topbar (hotel switcher,
                                 # notifications), nav config
    charts/                       # recharts wrappers (revenue, occupancy,
                                 # bookings, room-status)
  lib/
    auth/                        # permission catalog, require*() guards,
                                 # hotel-switch verification
    services/                     # business logic — see §2-§7
    queue/                        # BullMQ connection + the operations
                                 # sweep queue/worker
    security/                     # audit log, structured logger, encryption
  generated/prisma/               # generated Prisma client (gitignored)
tests/
  setup.ts
  utils/, security/                # pure unit tests
  integration/                     # DB-backed: double-booking prevention,
                                 # cross-hotel isolation — run against the
                                 # same local Postgres as `npm run dev`
```

## 7. Operational Workflows

- **Reservation lifecycle**: `PENDING → CONFIRMED → CHECKED_IN →
  CHECKED_OUT`, with `CANCELLED`/`NO_SHOW` as terminal branches from
  `PENDING`/`CONFIRMED`. `lib/services/reservations.ts` owns every
  transition; `lib/services/front-desk.ts` owns check-in/check-out
  specifically (including the walk-in shortcut: find-or-create guest →
  create reservation → optional payment → optional immediate check-in, as
  one call).
- **Room status machine** (`lib/services/rooms.ts`,
  `canTransitionRoomStatus()`): `AVAILABLE → RESERVED → OCCUPIED → DIRTY →
  CLEANING → INSPECTED → AVAILABLE`, with `MAINTENANCE`/`OUT_OF_SERVICE`
  reachable from most states. Check-in/check-out, housekeeping task
  transitions, and maintenance resolution all call the same
  `setRoomStatus()` — there is no other write path to `Room.status`, so
  `RoomStatusLog` is a complete history.
- **Housekeeping** (`lib/services/housekeeping.ts`): a task moves
  `PENDING → IN_PROGRESS → COMPLETED → INSPECTED`, driving the room through
  `DIRTY → CLEANING → INSPECTED(awaiting sign-off) → AVAILABLE`. A failed
  inspection reopens the task (`PENDING`) and sends the room back to
  `DIRTY` rather than leaving it stuck.
- **Maintenance** (`lib/services/maintenance.ts`): `REPORTED → ASSIGNED →
  IN_PROGRESS → COMPLETED`/`CANCELLED`. Taking a room out of service is an
  explicit choice at report time (`takeRoomOutOfService`) rather than
  automatic, since a reported issue on an occupied room usually shouldn't
  silently block checkout.
- **Guest folio** (`lib/services/folio.ts`): computed live from the
  reservation's room charge, `AdditionalCharge` rows, and completed
  `Payment` rows — never a cached total. The same folio function backs both
  the reservation detail page and invoice generation.
- **Financial reporting** (`lib/services/reports.ts`): occupancy, revenue
  (by day and by payment method), reservations (by status/source,
  check-ins/check-outs/cancellations/no-shows), room performance, popular
  room types, guest statistics, and expenses — all computed from live rows
  for an arbitrary date range. `profitEstimate()` is explicitly labeled as
  an estimate (revenue collected minus recorded expenses) everywhere it's
  shown, not represented as accounting-grade profit.
- **Daily operations sweep** (`lib/services/operations-sweep.ts`, run by
  `scripts/worker.ts` via a BullMQ repeatable job — the platform's one
  recurring background job): reminds staff of tomorrow's arrivals/
  departures, flags checked-out reservations with a balance outstanding
  more than 3 days, and auto-flags a reservation `NO_SHOW` (freeing the
  room) if a full day has passed since its check-in date with no check-in.

## 8. Multi-Branch / Hotel Groups (architecture, not yet UI)

`Hotel.parentGroupId` (a self-relation) lets a hotel belong to a parent
group hotel (`isGroupHQ: true`, no rooms/guests/reservations of its own) —
"Royal Hotel Group → Lagos Branch → Abuja Branch" is representable today
without a schema change. Combined with `HotelMember` allowing one `User` to
hold independent roles at multiple `Hotel` rows, and the hotel-switcher
already wired in the topbar (`resolveHotelSwitch()` +
`useSession().update()`), a group owner managing several properties is an
additive UI feature (a cross-hotel rollup dashboard), not a rewrite.

## 9. Security Architecture

- **Passwords**: bcrypt, cost factor 12.
- **Sessions**: JWT, HttpOnly cookies (Auth.js default); every `/app/*` and
  `/super/*` request is guarded by `proxy.ts` and then by a
  `requirePermission()`/`requireSuperAdmin()` call in the page/action
  itself.
- **Hotel isolation**: see §4 — the load-bearing guarantee is "hotelId
  always comes from the session," not client input.
- **Input validation**: Zod schemas on every server action; Prisma
  parameterizes all queries.
- **Audit log**: `recordAuditLog()` (hotel-scoped, or `hotelId: null` for a
  platform-level Super Admin action) called from every meaningful mutation
  — reservation created/cancelled/checked-in/checked-out, payment recorded,
  room status changed, expense recorded, staff/permission changes, hotel
  subscription changes.
- **Invoice access**: `/api/invoices/[id]/pdf` requires
  `PERMISSIONS.INVOICES_VIEW` and looks the invoice up scoped to the
  caller's `hotelId` — a valid invoice id from a different hotel resolves
  to "not found," not the PDF (verified live: see the isolation check in
  §4's test, and the same pattern manually verified against the running
  app).
- **Secrets**: `AUTH_SECRET` from the environment, never hardcoded;
  `.env.example` ships placeholders only.

## 10. UI/UX Architecture

- A small token layer in `globals.css` (`--background`, `--surface`,
  `--accent`, status colors) drives every component — one accent color, no
  gradients, restrained radius/shadow, a professional icon set (lucide-react,
  no emoji).
- `components/ui/*` are the shared primitives (Button, Card, Badge, Input,
  StatusBadge, EmptyState, Pagination) reused across the hotel app and the
  Super Admin console.
- `StatusBadge` centralizes color/label mapping for every enum in the
  system (reservation, room, payment, invoice, housekeeping, maintenance,
  hotel, employment status) so a status never renders inconsistently
  between pages.
- Real charts (`components/charts/*`, recharts) for revenue, occupancy,
  bookings, and room-status breakdown — driven by the services in §7, never
  static/sample data.
- Loading/empty states: `EmptyState` used wherever a list can legitimately
  be empty (no reservations yet, no housekeeping tasks, ...).

## 11. What's Deliberately Not Built Yet

Per the platform's own "future features" scope, the architecture is shaped
to add these without a rewrite, but they are not implemented:

- Real email/SMS/WhatsApp delivery for notifications (today: real, functional
  in-app notifications only — `NotificationChannel` already models the other
  channels).
- A public booking engine / guest-facing website (online bookings can be
  entered by staff today via `ReservationSource.ONLINE`; there's no
  unauthenticated booking flow).
- Payment gateway integration (payments are recorded by staff against a
  method, e.g. card/POS/bank transfer; there's no online payment capture).
- Restaurant/Bar POS, inventory, and laundry management as first-class
  modules (`AdditionalCharge` already models restaurant/bar/laundry/mini-bar
  charges against a stay, but not standalone POS/inventory systems).
- OTA/channel manager integrations (Booking.com, Airbnb).
- A cross-hotel rollup dashboard for group owners (the data model supports
  it — §8 — the UI does not exist yet).
