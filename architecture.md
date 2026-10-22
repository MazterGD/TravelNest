# System Overview

TravelNest operates as a **modular monolith**: a single deployable Express backend with internally separated domain modules, fronted by a Next.js PWA. The choice reflects the solo-developer constraint and a **zero-cost (free-forever tier) infrastructure requirement**, while keeping the option of extracting modules into independent services later.

The codebase is a **pnpm monorepo** (pnpm 10, Node.js ≥ 18; CI runs Node 20):

```
/
├── apps/
│   ├── api/          — Node.js/Express backend (modular monolith) + Socket.IO server
│   └── web/          — Next.js 16 PWA (customer, owner, admin portals)
└── packages/
    ├── database/     — Prisma schema, migrations, seed + backfill scripts, bank-field encryption
    └── shared-types/ — TypeScript type definitions shared across apps
```

**End-to-end request lifecycle:**

```
User (Browser / installed PWA)
    ↓ HTTPS
Next.js 16 Frontend (App Router, next-intl locale routing, Workbox service worker)
    ↓ REST (JSON, cookie auth + CSRF header)        ↓ WebSocket (Socket.IO, same JWT)
Node.js/Express Backend — Modular Monolith  (/api/v1/*, /socket.io, /health)
    ├── Auth            (password + Email OTP login, JWT access/refresh, Google/Facebook OAuth)
    ├── User / Owner    (profiles, owner onboarding & documents, owner analytics & earnings)
    ├── Vehicle         (fleet CRUD, photos/documents, availability, PostGIS radius search)
    ├── Driver          (owner driver roster, booking assignment)
    ├── Trip            (customer trip planning; parents the quotation pipeline)
    ├── Quotation       (request → owner pricing → accept)
    ├── Booking         (reserve → pay → confirm → ongoing → complete / cancel)
    ├── Trip Package    (fixed-price packages, direct booking)
    ├── Payment         (PayHere + bank transfer + cash, refunds, settlement accrual)
    ├── Review / Dispute / Message / Notification
    ├── Routing         (OSRM route calculation)
    ├── Landing / Content (CMS-driven public content, contact form, route estimate)
    └── Admin           (verification, users, bookings, disputes, finance, CMS, reports, settings, audit)
    ↓
PostgreSQL 16 + PostGIS (via Prisma ORM)

In-process background jobs (setInterval): bookingLifecycle (15 min), notificationRetention (daily)

External services (outbound from backend):
    ├── OSRM (self-hosted Docker)  → Route geometry, distance/duration
    ├── PayHere API                → Checkout, MD5-signed webhook, merchant refund API
    ├── Brevo SMTP (nodemailer)    → OTP, password reset, booking/payment notification emails
    ├── Supabase Storage           → Vehicle photos, documents, avatars, payment receipts
    └── Google / Facebook OAuth    → Direct OAuth 2.0 (no Passport.js)

External services (called directly from the browser):
    ├── OpenStreetMap tiles        → Leaflet maps
    └── Nominatim (OSM)            → Location autocomplete / geocoding

Observability (current): Morgan HTTP access logs + console
```

The frontend serves three portal contexts from one Next.js application: the customer marketplace (`/dashboard/*` plus public pages), the bus owner portal (`/owner/*`), and the admin back office (`/admin/*`). There are **89 page routes** in total, all under the `[locale]` segment (`en` / `si` / `ta`).

---

## Technology Stack

### Frontend (`apps/web`)

| Component | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (React 19.2), App Router, Turbopack dev | Locale routing via `src/proxy.ts` (next-intl middleware, `localePrefix: "always"`) |
| Styling | Tailwind CSS 4 (`@tailwindcss/postcss`) | Design tokens in `globals.css` per `TravelNest-Design-System.md` |
| Animation | `motion` (`motion/react`) | Spring tokens per design system |
| Icons | `lucide-react` | |
| State | `zustand` (auth, booking, quotation stores) | |
| HTTP client | `axios` (`src/lib/api/client.ts`) | Client unwraps `response.data` envelope |
| Realtime client | `socket.io-client` | Chat and notification stream |
| Maps | `leaflet` + `react-leaflet` with OpenStreetMap tiles | Free; no API key |
| Geocoding | Nominatim (OSM) public API | `LocationAutocomplete`, `InteractiveMap` |
| Charts | `recharts` | Owner and admin analytics |
| PWA | `@ducanh2912/next-pwa` (Workbox) + `public/manifest.json` | Disabled in development |
| i18n | `next-intl` 4, JSON files in `src/i18n/locales/{en,si,ta}` | |
| Printable documents | Browser print of generated HTML (`lib/utils/pdfUtils.ts`) | Invoices, quotations, booking documents |
| Tests | Vitest + Testing Library + jsdom | `src/__tests__` |

### Backend (`apps/api`)

| Component | Technology | Notes |
|---|---|---|
| Runtime | Node.js (ESM, `tsx` in dev, `tsc` build) | |
| Framework | Express 4 | |
| ORM | Prisma 6 | 42 models, 27 enums, 32 migrations (Jan–Oct 2026); soft-delete read filter in `packages/database/src/index.ts` |
| Authentication | JWT (`jsonwebtoken`) access + refresh tokens with `tokenVersion` | Tokens in cookies; refresh rotation |
| OAuth | Hand-rolled OAuth 2.0 code flow for Google and Facebook | JWT-signed `state` (`OAUTH_STATE_SECRET`); **no Passport.js** |
| Password hashing | `bcryptjs` | Account lockout via `failedLoginAttempts` / `lockedUntil` |
| Validation | Zod via `middleware/validate.ts` | Applied on most modules; see Known Gaps |
| Sanitization | `xss` | User-supplied text in auth/profile flows |
| Security middleware | Helmet (CSP), CORS with credentials, double-submit CSRF, `express-rate-limit` | See Security |
| Uploads | `multer` (memory storage) → Supabase Storage | 5 MB default limit |
| Email | `nodemailer` over Brevo SMTP relay | No-op when SMTP is unconfigured |
| Realtime | Socket.IO 4 on the same HTTP server (`/socket.io`) | Rooms `user:<id>` and `conversation:<id>` |
| Reports | `exceljs` (Excel), `pdfkit` (PDF), CSV | Admin report exports |
| Logging | `morgan` (`dev` / `combined`) + `console` | Pino is a roadmap item |
| Tests | Vitest + Supertest | ~410 tests (unit, integration, security regression); run against a dedicated test database (CI: PostGIS service) |

### Database

| Component | Technology | Notes |
|---|---|---|
| Primary store | PostgreSQL 16 | ACID guarantees for financial transitions |
| Spatial | **PostGIS** extension | `vehicles.geom` (trigger-maintained, GIST-indexed) for radius search; `itinerary_stops` / `itinerary_routes` geometry |
| Migrations | Prisma Migrate | PostGIS extension, triggers and GIST indexes live in raw-SQL migrations, so use `migrate deploy`, not `db push` |
| Seed | `packages/database/src/seed.ts` | Date-parameterised (`pnpm db:seed 2026-06-03` or `SEED_DEMO_DATE`) |
| Backfills | `backfill:content`, `backfill:vehicle-coordinates`, `backfill:osrm-routes`, `backfill:settlement-bank-encryption` | Idempotent maintenance scripts |

### Infrastructure & DevOps (all free-forever tiers)

| Component | Choice | Notes |
|---|---|---|
| Web hosting | **Vercel Hobby** | Root directory `apps/web`; Hobby is non-commercial use only (fine for the academic deliverable; Pro needed for a commercial launch) |
| API hosting | **Oracle Cloud Always Free VM** (Ampere A1) | Long-running Node process (PM2 or Docker); needed for Socket.IO and in-process jobs, which serverless (Vercel) cannot host |
| Routing engine | **OSRM, self-hosted via Docker** on the same VM | Sri Lanka OSM extract; `OSRM_BASE_URL` (dev default `http://127.0.0.1:5001`) |
| Reverse proxy / TLS | Caddy (automatic Let's Encrypt) on the VM | Planned; not in repo |
| Database | Managed free Postgres with PostGIS (Supabase or Neon) | Supabase free projects pause after 7 days inactive; Neon scales to zero |
| File storage | Supabase Storage: public `travenest` bucket (photos, avatars) + private `travenest-private` bucket (documents, receipts) | Private files are served as 1-hour signed URLs (ADR-001) |
| Email | Brevo free tier (300 emails/day) | |
| CI | GitHub Actions (`ci.yml`, `pr.yml`, `codeql.yml`) | Lint, typecheck, API + web tests on a PostGIS service with `db:migrate:deploy` and a schema-drift check, build, `pnpm audit --prod` gate, CodeQL |
| CD | `.github/workflows/cd.yml` | Validation job is active; deploy steps are commented-out placeholders |
| Error tracking | Sentry Developer (free) | **Roadmap**; no SDK installed yet |

---

## Deployment Topology (planned)

```
                 ┌──────────────────────────┐
  Browser ──────▶│ Vercel (apps/web)        │  app.<domain>
     │           └──────────────────────────┘
     │           ┌──────────────────────────────────────────────┐
     └──────────▶│ Oracle Always Free VM                        │  api.<domain>
                 │  Caddy (TLS) → Node API :5000 (PM2)          │
                 │               └─▶ OSRM container :5001       │
                 └──────────────────────────────────────────────┘
                          │                         │
                 Supabase/Neon Postgres+PostGIS   Supabase Storage
```

Deployment notes:
- **Same-site domains are strongly recommended.** Auth cookies are `SameSite=None; Secure` in production, but browsers increasingly block third-party cookies. Serving web and API from subdomains of one registrable domain (for example `app.` and `api.`) keeps the refresh and CSRF cookies first-party. Plain `*.vercel.app` + a different API host is fragile.
- **Oracle Always Free caveats:** the A1 allowance was reportedly reduced in 2026 (to about 2 OCPU / 12 GB), which is still sufficient for the API and the Sri Lanka OSRM graph. Instances idle for 7 days (95th-percentile CPU, network and memory under 20%) are eligible for reclamation.
- **Background jobs** run in-process, so the API must run as a **single instance**. Scaling out requires pinning jobs to one instance and moving Socket.IO to a shared adapter.
- **PayHere webhooks** need a public HTTPS `PAYHERE_NOTIFY_URL`. Locally, use ngrok or the simulator (`pnpm --filter @travenest/api payhere:simulate <bookingId>`).
- `GET /health` returns `{ status, timestamp, uptime }` for liveness checks.
- Production environment (see `apps/api/.env.example`): set `TZ=Asia/Colombo` (trip-day checks use server-local dates), `TRUST_PROXY=1` behind Caddy, `COOKIE_DOMAIN` when web and API are sibling subdomains, `SUPABASE_SERVICE_ROLE_KEY` and a private `SUPABASE_PRIVATE_BUCKET`. The API refuses to start in production without the JWT secrets, `CORS_ORIGIN`, `APP_URL`, PayHere merchant credentials and the service-role key.
- One-off after the private bucket exists: `pnpm --filter @travenest/api storage:backfill-private --apply` moves existing documents and receipts out of the public bucket (dry run without `--apply`).
- The seed script resets data and creates accounts with known demo passwords; it refuses to run when `NODE_ENV=production`.

---

## Data Flow & Core Entities

### Primary Domain Entities

The Prisma schema (`packages/database/prisma/schema.prisma`) has 42 models. Table names are snake_case via `@@map`. `User`, `Vehicle`, `VehiclePhoto`, `VehicleDocument`, `OwnerDocument`, `Driver`, `TripPackage`, `Review`, `Notification`, `Faq` and `Testimonial` carry `isRemoved` / `removedAt` for soft delete (ADR-006); a removed user's email and a removed vehicle's licence plate get a `#removed-<id>` suffix so they can be registered again.

**Identity & Access**
- `User` (`users`): single identity table for all roles. `role`: `CUSTOMER | VEHICLE_OWNER | ADMIN`; `adminRole`: `SUPER_ADMIN | MODERATOR | FINANCE_ADMIN | SUPPORT_ADMIN`; `status`: `ACTIVE | INACTIVE | SUSPENDED | PENDING_VERIFICATION`. Owner business fields (`businessName`, `businessRegNumber`, `tinNumber`) and verification fields (`verifiedAt`, `rejectionReason`) live on the user row. Security fields: `tokenVersion`, `failedLoginAttempts`, `lockedUntil`, `lastLoginAt`.
- `AdminPermission`: granular permission strings per admin, enforced by `requireAdminPermission()`.
- `OtpToken`: hashed OTP codes (`LOGIN | REGISTRATION | PHONE_VERIFICATION`) with expiry and attempt counting.
- `PasswordResetToken`: hashed single-use reset tokens.
- `AuditLog`: actor-based audit trail (`actorId`, `actorRole`, `action`, `entityType/Id`, `changes`, IP, user agent, status).

**Fleet & Inventory**
- `Vehicle`: `type`: `ORDINARY | SEMI_LUXURY | LUXURY_AC`; `acType` (`full-ac | ac | non-ac`); seats, fuel, transmission; `amenities String[]`; pricing (`pricePerDay`, `pricePerKm`, `fuelCostPerKm`, `driverAllowance`, minimums); `latitude/longitude` plus trigger-derived PostGIS `geom`; `isActive` / `isAvailable`.
- `VehiclePhoto`: `tag`: `EXTERIOR | INTERIOR | FRONT | REAR | SEATS | OTHER`, `isPrimary`, `sortOrder`.
- `VehicleDocument` / `OwnerDocument`: `type`: `NIC | DRIVING_LICENSE | INSURANCE | REGISTRATION_CERTIFICATE | PROFILE_PHOTO | VEHICLE_PHOTO`; `status`: `PENDING | VERIFIED | REJECTED`; per-document admin review.
- `VehicleAvailability`: date-range blocks (owner-blocked or booking-blocked).
- `Amenity`: admin-managed amenity catalogue (vehicles store amenity codes as an array, not a join table).
- `Driver`: owner driver roster (`ACTIVE | INACTIVE`); assigned to bookings via `Booking.driverId`.

**Trip & Quotation Pipeline**
- `Trip` (`trips`): `tripCode` (`TRP-YYYY-NNN`); pickup/dropoff with city, district and coordinates; dates, round-trip flag, passengers, vehicle-type preference, `needsAC`; OSRM estimates; itinerary JSON. `status`: `PLANNING | AWAITING_QUOTES | CONFIRMED | COMPLETED | CANCELLED | EXPIRED`.
- `Quotation` (`quotations`): request and owner response in one row; `quotationId` (`QUO-YYYY-NNN`), `tripId`; cost breakdown (`vehicleRentalCost`, `driverCost`, `fuelCost`, `tollCharges`, `permitFees`, `customItems`, `subtotal`, `tax`, `totalAmount`); `validUntil`. `status`: `PENDING | SENT | VIEWED | ACCEPTED | REJECTED | EXPIRED`.
- `ItineraryStop` / `ItineraryRoute`: PostGIS point and linestring geometry per quotation (OSRM route stored, not recomputed on view).

**Transaction**
- `Booking`: `status`: `PENDING | CONFIRMED | ONGOING | COMPLETED | CANCELLED`; `quotationId` FK (nullable; legacy rows resolve via `QUO-` code in `notes`); optional `tripPackageId`; driver fields (`driverId`, plus denormalized `driverName`, `driverPhone`, `driverLicense`).
- `TripItinerary`: per-day itinerary for multi-day bookings.
- `TripPackage`: owner fixed-price packages, bookable directly.
- `Payment`: one per booking; `status`: `PENDING | PROCESSING | COMPLETED | FAILED | REFUNDED`; `method` string (card / bank transfer / cash); PayHere ids; bank-receipt fields inline (`bankReceiptUrl`, name, size, mime, timestamp); `refundAmount`, `refundReason`.
- `Settlement` + `SettlementBooking`: owner payout ledger (`PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED`). Paid bookings accrue automatically into the owner's open settlement; cancellation or refund unwinds the line.
- `OwnerBankAccount`: owner payout account, `accountNumber` encrypted at rest.
- `CommissionRule`: `PERCENTAGE | FIXED | TIERED` with effective date ranges.

**Trust & Communication**
- `Review`: overall `rating` (1–5) plus **six optional sub-ratings** (vehicle condition, driver behaviour, punctuality, cleanliness, value for money), `isRecommended`, `ownerResponse`; one per booking.
- `Conversation` (unique per booking) + `Message` (`readAt`): booking-scoped customer ↔ owner chat.
- `Dispute`: `type`: `BOOKING_QUALITY_ISSUE | CANCELLATION_DISPUTE | PAYMENT_ISSUE | VEHICLE_CONDITION | BEHAVIOR_COMPLAINT | SERVICE_NOT_PROVIDED | OTHER`; `priority`: `LOW | MEDIUM | HIGH | URGENT`; `status`: `OPEN | INVESTIGATING | RESOLVED | CLOSED | ESCALATED`; evidence URLs; resolution fields.
- `DisputeMessage`: thread with `isInternalNote` for admin-only notes.
- `Notification`: in-app notification records (`type`, `category`, `data`, `isRead`).
- `PlatformNotification`: admin broadcast notifications (`IN_APP | EMAIL | SMS` channel enum; `DRAFT | SCHEDULED | SENT | FAILED | CANCELLED`) with resend lineage.

**Platform Operations & CMS**
- `PlatformSettings`: JSON groups (`general`, `notification`, `payment`, `booking`, `security`, `map`, `pricing`), `maintenanceMode`. `bookingSettings` holds `autoCancelUnpaidHours` and the refund policy; `pricingSettings` holds platform base rates per vehicle type.
- `PlatformConfig`: key/value JSON store used by the landing/contact content (overlaps with `PlatformSettings`; consolidation is a housekeeping item).
- `ContentPage` (slugged pages: privacy, terms, refund policy, etc.), `Faq`, `Testimonial`, `PopularRoute`, `TrustedPartner`, `PlatformStat`.
- `ContactMessage`: contact form submissions with `referenceId` and reply tracking.
- `ScheduledReport` + `ScheduledReportRun`: report definitions (`USERS | BOOKINGS | FINANCIAL | OPERATIONS | AUDIT | DISPUTES | VERIFICATIONS | SYSTEM`; `CSV | PDF | EXCEL`) and run history.

### Core Data Flow: Trip-to-Booking

```
1. Customer plans a Trip
   → Pickup/dropoff picked via Nominatim autocomplete; route computed by OSRM
     (POST /routing/calculate or /landing/route-estimate)
   → Trip created (PLANNING) with distance/duration estimates and itinerary JSON

2. Customer requests Quotations for the Trip
   → One Quotation (PENDING) per vehicle, tripId set; Trip → AWAITING_QUOTES
   → If an active trip exists, the UI asks: attach to it or start a new trip

3. Owner prices the Quotation
   → Form pre-fills from platform pricing: rental = vehicle.pricePerKm × trip distance,
     fuel = fuelCostPerKm × distance, plus driver cost and toll defaults
   → Owner adjusts line items / custom items, sets validity → SENT (validUntil set)
   → Customer opening it → VIEWED

4. Customer compares and accepts one Quotation
   → Booking created as PENDING (a reserve holding the vehicle's dates), quotationId FK set
   → Sibling quotations under the Trip are auto-rejected; Trip → CONFIRMED
   → No owner re-confirmation step

5. Payment
   → PayHere: checkout → MD5-signed webhook verified → Payment COMPLETED
   → Bank transfer: receipt upload → PROCESSING → admin/owner confirms → COMPLETED
   → Cash: recorded for on-site settlement
   → On completion, in one $transaction: Booking PENDING → CONFIRMED,
     VehicleAvailability block created, settlement line accrued (idempotent)
   → Notifications created (in-app + Socket.IO push; booking_confirmed and
     payment_received are also emailed via Brevo)

6. Trip execution
   → Owner assigns a Driver from the roster, starts the trip (ONGOING), completes it
   → Customer can review (overall + six sub-ratings), message the owner, or raise a dispute

7. Cancellation
   → Unpaid reserve: hold released
   → Paid: refund % from the configurable policy (refundFullHours / refundPartialHours /
     refundPartialPercent); PayHere merchant refund API when configured, otherwise
     the amount is recorded for admin payout; settlement line unwound
```

### Background Jobs

In-process `setInterval` timers (unref'd), registered in `src/index.ts`:

| Job | Cadence | Responsibility |
|---|---|---|
| `bookingLifecycle` | every 15 min (first run ~90 s after boot) | Cancel unpaid `PENDING` reserves older than `autoCancelUnpaidHours` (default 24 h; cash and receipt-uploaded reserves exempt) and return the trip to `AWAITING_QUOTES`; expire `SENT`/`VIEWED` quotations past `validUntil`; expire stale `PLANNING`/`AWAITING_QUOTES` trips |
| `notificationRetention` | daily | Purge read notifications older than 90 days |

Quotation and trip expiry is also applied lazily on read. Scheduled-report definitions exist, but **no job executes them automatically**; reports run on demand from the admin portal.

### Module Layout

Each module in `apps/api/src/modules/<domain>/` follows `<domain>.routes.ts` → `<domain>.controller.ts` → `<domain>.service.ts`, with Zod schemas in `<domain>.schemas.ts`. The admin module is split into sub-modules: `amenities`, `analytics`, `audit`, `bookings`, `content`, `dashboard`, `disputes`, `faqs`, `financial` (settlements, commissions), `notifications`, `profile`, `reports`, `reviews`, `settings`, `testimonials`, `users`, `vehicles`, `verifications`.

REST base path: `/api/v1`. Mounted routers: `auth`, `users`, `vehicles`, `bookings`, `quotations`, `trips`, `reviews`, `disputes`, `payments`, `notifications`, `messages`, `owner`, `packages`, `uploads`, `admin`, `landing`, `content`, `routing`, `drivers`.

---

## Integration Points

| Service | Provider | Method | Status |
|---|---|---|---|
| Routing & distance | OSRM, **self-hosted Docker** | HTTP via `axios`: `/trip/v1/driving` (API routing module), `/route/v1/driving` (seed and backfill scripts); geometry persisted to PostGIS | Implemented |
| Maps | OpenStreetMap tiles | Leaflet in the browser | Implemented |
| Geocoding | Nominatim (OSM public API) | Browser `fetch` | Implemented (public usage policy: ≤1 req/s, no heavy use) |
| Payments | PayHere (LK) | Checkout + MD5-verified webhook (`POST /payments/webhook`) + merchant API OAuth + refund API | Implemented (sandbox and live) |
| Email | Brevo SMTP relay | `nodemailer` | Implemented: OTP, password reset, booking-confirmed and payment-received emails |
| File storage | Supabase Storage | `@supabase/supabase-js`: publishable key (public bucket), service-role key on the API only (private bucket, signed URLs) | Implemented |
| OAuth | Google, Facebook | Direct OAuth 2.0 code exchange (`fetch`) | Implemented |
| Error tracking | Sentry (Developer free tier) | `@sentry/*` SDKs | Roadmap |

**Free-tier rationale:** paid or time-limited tools were replaced with free-forever options. Google Maps became OSRM + Leaflet/OSM + Nominatim, AWS S3 became Supabase Storage, Twilio SMS was dropped in favour of email OTP via Brevo, Passport.js became a direct OAuth implementation, and self-hosted Redis/GlitchTip were deferred.

**PayHere webhook dependency:** if webhook delivery fails, a card payment can stay `PROCESSING`. Retry and reconciliation handling is a hardening item.

---

## Security & Scalability Considerations

### Security (implemented)

**Authentication & sessions**
- JWT access and refresh tokens (HS256 pinned); refresh token in an httpOnly cookie (`SameSite=None; Secure` in production, `Lax` in development; optional `COOKIE_DOMAIN` for sibling subdomains); refresh rotation. Every access token must resolve to an existing, active, non-removed user; `tokenVersion` is checked on every request and socket handshake, so password changes and account removal invalidate all sessions.
- Password login with bcrypt, account lockout and no account enumeration (dummy hash for unknown emails, status disclosed only after a correct password); passwordless email OTP login (crypto-random codes, hashed, expiry, atomic attempt limit, per-address resend cooldown, generic responses).
- Registration requires a short-lived proof issued when the registration OTP is verified (ADR-007).
- Password-reset tokens are stored as SHA-256 hashes, looked up directly and single-use.
- OAuth `state` is a signed JWT with its own secret and audience, bound to the browser by an httpOnly nonce cookie; tokens never travel in redirect URLs; Google logins require a verified email.

**Request hardening**
- Helmet with an explicit CSP; CORS restricted to `CORS_ORIGIN` with credentials.
- **CSRF:** double-submit cookie (`csrf-token` cookie + `x-csrf-token` header, length-checked timing-safe compare) on every authenticated mutating route, including `/admin/*`. Anonymous endpoints (auth, registration uploads, contact form) have no session to forge. Skipped when `NODE_ENV=test`.
- **Rate limiting:** global 100 req / 15 min and auth 10 req / 15 min per IP, plus per-route limits on registration uploads, the contact form and route estimates; **enforced only when `NODE_ENV=production`**, using the in-memory store. Behind Caddy set `TRUST_PROXY=1` so limits key on the client IP.
- Socket.IO refuses handshakes whose `Origin` is not `CORS_ORIGIN` (cross-site WebSocket hijacking).
- File URLs accepted from clients must be TraveNest storage references and must not belong to another account; uploads are authorized before files are stored.
- RBAC: `authenticate`, `isCustomer`, `isVehicleOwner`, `isAdmin`, plus `requireAdminRole()` / `requireAdminPermission()` for admin sub-roles.
- Audit logging middleware records every authenticated mutation under `/api/v1`.

**Data integrity**
- Payment completion, booking confirmation, availability blocking and settlement accrual run in a single Prisma `$transaction()` and are idempotent for webhook retries; the same path serves the PayHere webhook, admin bank-transfer confirmation and owner cash confirmation (ADR-002).
- PayHere webhook: refused without a merchant secret; MD5 signature compared in constant time; merchant id, currency and amount must match the stored payment; COMPLETED/REFUNDED states are final; money arriving for a cancelled booking is recorded as owed back. The charged amount is always the booking total.
- Race-safe transitions (ADR-004): quotation accept, package booking, cancellations, refunds and settlement payouts claim their state with conditional updates; per-vehicle and per-owner advisory locks serialise booking creation and settlement accrual/payout.
- Soft delete (ADR-006): user and admin deletions mark rows `isRemoved`; the shared Prisma client hides removed rows from reads unless a query opts in (admin views).
- Owner bank account numbers and settlement bank fields encrypted at rest (`packages/database/src/settlementBankEncryption.ts`; key from `SETTLEMENT_BANK_ENCRYPTION_KEY`, else `BANK_DATA_ENCRYPTION_KEY`, else derived from `JWT_SECRET`, so set an explicit key in production).

### Known Gaps (open security and hardening items)

| Gap | Current behaviour | Target |
|---|---|---|
| Validation coverage | `booking.routes.ts` has no Zod schemas (validated in handlers/services) | Add `booking.schemas.ts` |
| Rate limiter store | In-memory; resets on restart; not shared across instances | Redis store (roadmap) |
| Refresh tokens | Stateless JWTs; logout clears the cookie but cannot revoke a copied token before it expires | Server-side token store with reuse detection (schema change) |
| Logging | Morgan + `console`; no structured logs or PII redaction policy | Pino (roadmap) |
| Error tracking | None | Sentry Developer free tier (roadmap) |

### Scalability

- The modular monolith on one VM targets the stated 500 concurrent users. Vertical scaling is the first lever.
- Horizontal scaling is blocked by in-process jobs and the single-instance Socket.IO adapter. Both need a shared backend (Redis adapter, distributed scheduler) first.
- PostgreSQL is the main contention point; use the provider's connection pooler (Supabase pooler or Neon pooled URL) in production.

**Caching (roadmap, not implemented).** There is currently no application cache. Search queries hit Postgres directly. OSRM results for quotations are persisted in `itinerary_routes`, so route detail pages read stored geometry rather than calling OSRM again. Planned Redis usage:

| Cache target | Key pattern | TTL |
|---|---|---|
| OSRM route results | `osrm:route:{coords_hash}` | 24 h |
| Vehicle search results | `search:{filter_hash}:{page}` | 5 min |
| Rate-limiter counters | `rl:{ip}:{route}` | 15 min window |
| Socket.IO adapter | — | — |

**Indexes in place:** `bookings(customerId, status, startDate)`, `bookings(vehicleId, startDate, endDate)`, `bookings(driverId, startDate, endDate)`, `quotations(tripId)`, `quotations(validUntil)`, `trips(customerId, status)`, GIST on `vehicles.geom`, plus per-FK indexes.

**Performance targets:** initial content < 2 s on 4G; ≥ 500 concurrent users; ≥ 99.9% uptime (best effort on free tiers).

### Observability

- **Current:** Morgan access logs (`dev` format locally, `combined` otherwise), `console` output for jobs and services, `GET /health`, `GET /api/v1/admin/health`.
- **Roadmap:** Pino structured JSON logging with redaction; Sentry Developer free tier (1 user, ~5k errors/month) for both apps.
