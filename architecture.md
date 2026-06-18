# System Overview

TravelNest operates as a **modular monolith** — a single deployable backend application with internally separated domain modules — fronted by a Next.js PWA. The architectural choice reflects the project's solo-developer constraint and cost-optimization requirement while retaining the ability to extract modules into independent services if scale demands it.

The codebase is organized as a **pnpm monorepo** with the following workspace structure:

```
/
├── apps/
│   ├── api/          — Node.js/Express backend (modular monolith)
│   └── web/          — Next.js 16 PWA (customer, owner, admin portals)
└── packages/
    ├── database/     — Prisma schema, migrations, seed scripts
    └── shared-types/ — TypeScript type definitions shared across apps
```

Because the frontend and backend share code via `packages/`, they cannot be independently deployed to platforms that build only one app per repository root without additional monorepo build configuration. The hosting platform must support monorepo co-deployment or multi-service deployment from a single repository. **[Undecided — see Infrastructure & DevOps.]**

**End-to-end request lifecycle:**

```
User (Browser/PWA)
    ↓ HTTPS
Next.js Frontend (SSR/SSG + PWA)
    ↓ REST API calls (JSON)
Nginx Reverse Proxy (entry-point routing)   ← planned; no nginx.conf in repo yet
    ↓
Node.js/Express Backend — Modular Monolith
    ├── Auth Module        (JWT, Email OTP, OAuth via Passport.js)
    ├── Trip Module        (customer trip planning; parents the quotation pipeline)
    ├── Booking & Quotation Module
    ├── Vehicle & Fleet Module
    ├── Trip Package Module
    ├── Payment Handler    (PayHere + bank transfer + cash)
    ├── Notification Handler (Brevo transactional email via nodemailer)
    ├── Admin Module       (verification, disputes, settlements, CMS)
    └── Analytics Module   (owner analytics, platform analytics)
    ↓
PostgreSQL 16+ (via Prisma ORM)
    ↓
Redis (self-hosted — Docker)     (caching layer — see Caching Strategy)

External Service Calls (outbound from backend):
    ├── OSRM Public API      → Road-based distance computation, route display
    ├── PayHere API          → Payment processing, MD5-signed webhook callbacks
    ├── Brevo SMTP           → Transactional email: OTP, booking confirmation, notifications
    ├── Supabase Storage     → Vehicle/review photos, owner documents, payment receipts
    └── OAuth Providers      → Google, Facebook (Passport.js)

Observability:
    ├── Pino                 → Structured JSON logging (Node.js backend)
    └── GlitchTip (Docker)   → Error tracking and alerting (Sentry-SDK-compatible, self-hosted)
```

The frontend serves three distinct portal contexts from a single Next.js application: Customer-facing marketplace, Bus Owner dashboard, and Admin back-office dashboard (84 routes total).

---

## Technology Stack

### Frontend

| Component | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (React 19) | SSR/SSG for SEO and initial load performance; PWA support via Service Workers |
| Styling | Tailwind CSS 4 | Utility-first; enforces mobile-first design constraints |
| Icons | Lucide React | |
| PWA Layer | Service Workers + manifest.json | Offline capability; installable on mobile without native app; installable icons included |
| Internationalization | next-intl + locale JSON files | EN / SI / TA language support |
| Hosting | [Undecided — see Infrastructure & DevOps] | |

### Backend

| Component | Technology | Notes |
|---|---|---|
| Runtime | Node.js | Non-blocking I/O; consistent JS stack with frontend |
| Framework | Express.js | Lightweight; modular middleware composition |
| Architecture | Modular Monolith | Single deployable unit; domain separation without microservice operational overhead |
| ORM | Prisma | Type-safe database access; 18 migrations (Jan–Apr 2026) |
| Authentication | JWT (JSON Web Tokens) + token versioning | Stateless session management; `tokenVersion` field on User forces all tokens invalid on password change |
| OAuth | Passport.js | Google and Facebook strategy; OAuth state secret protection |
| Password Security | bcrypt | Industry-standard adaptive hashing |
| Input Validation | Zod | Schema validation across all API endpoints |
| Security Middleware | Helmet + CSRF (double-submit cookie) + CORS with credentials | See Security section for full detail |
| Rate Limiting | express-rate-limit | Global (100 req / 15 min) + stricter auth routes (10 req / 15 min) |
| Caching | Redis client (`ioredis`) | OSRM response cache, search result cache, rate-limiter store; self-hosted via Docker |
| API Protocol | REST (primary); GraphQL flagged as optional | REST is simpler for the defined use case scope |
| Real-time | Socket.IO (`socket.io` server + `socket.io-client`) | Mounted on the same HTTP server as Express at path `/socket.io`. Used by the messaging module (`Conversation` rooms `conversation:<id>` and per-user inbox rooms `user:<id>`). Handshake authenticates the same JWT used by REST (cookie or `auth.token`), re-validated against `tokenVersion`. Booking-status push and notification delivery remain on the roadmap. |

### Database

| Component | Technology | Notes |
|---|---|---|
| Primary Store | PostgreSQL 16+ | Relational; strong ACID guarantees for financial transactions |
| ORM | Prisma | Managed via `packages/database`; seed scripts included |
| Schema | 30+ models | See Data Flow & Core Entities section |
| Backup | Automated daily backups via `pg_dump` cron | Dumps stored to persistent volume or object storage |

### Infrastructure & DevOps

| Component | Technology | Notes |
|---|---|---|
| Hosting | **Undecided** — Oracle Cloud Always Free (4 ARM cores, 24 GB RAM), a managed VPS, or a monorepo-compatible PaaS (Railway, Render) are the candidate options. Decision pending. | Must support pnpm monorepo multi-app build and continuous process (no cold-start spin-down) |
| File Storage | Supabase Storage (`@supabase/supabase-js`) | `travenest` bucket; private access via presigned URLs; covers vehicle photos, owner documents, review photos, payment receipts |
| Caching | Redis OSS — **self-hosted via Docker** | `redis:7-alpine` image; co-located with backend; data persisted via Docker volume |
| Observability — Logging | Pino | Structured JSON logs from Node.js backend |
| Observability — Errors | GlitchTip — **self-hosted via Docker** | Sentry-SDK-compatible; no client SDK change required; only `SENTRY_DSN` env var points to self-hosted instance |
| Reverse Proxy / TLS | Nginx + Let's Encrypt (Certbot) | Planned; terminates TLS, routes to Next.js and API processes; no `nginx.conf` in repo yet |
| CI/CD | [Requires Clarification — pipeline not yet defined] | |

---

## Deployment & Containerization

All self-hosted infrastructure components are managed as Docker containers. The following services run via Docker on the production host:

| Service | Docker Image | Persistence | Notes |
|---|---|---|---|
| Redis | `redis:7-alpine` | Docker named volume (`redis_data`) | Append-only file (AOF) persistence enabled to survive container restarts |
| GlitchTip | `glitchtip/glitchtip` | Docker named volume + shared PostgreSQL schema or dedicated DB | Requires `SECRET_KEY`, `DATABASE_URL`, `DEFAULT_FROM_EMAIL` env vars; exposes port `8000` internally |
| Nginx | `nginx:alpine` | Config bind-mounted from host | Terminates TLS via Certbot; proxies `/api/*` to Express, `/*` to Next.js |

**Orchestration:** Docker Compose is the recommended orchestration layer for managing the service stack on a single host. A `docker-compose.yml` at the repository root should define all self-hosted services (Redis, GlitchTip, Nginx) alongside volume and network declarations.

**The Node.js API (`apps/api`) and Next.js frontend (`apps/web`) are run as host processes** managed by PM2 (or equivalent) rather than Docker containers, to take advantage of the pnpm monorepo build pipeline and `packages/` shared code. Containerizing these apps would require a multi-stage Dockerfile that replicates the monorepo workspace resolution — acceptable as a future hardening step.

**GlitchTip Integration Detail:**
- The existing Sentry SDK in `apps/api` and `apps/web` requires no code change.
- Only the `SENTRY_DSN` environment variable value changes to point to the self-hosted GlitchTip instance (e.g., `http://glitchtip:8000/api/<project-id>/`).
- GlitchTip shares the PostgreSQL instance (separate schema or separate database) to avoid introducing an additional database engine.

---

## Data Flow & Core Entities

### Primary Domain Entities

The PostgreSQL schema (managed via Prisma) contains 30+ models organized across seven domain clusters:

**Identity & Access**
- `users` — base identity record; `user_type` enum: `customer | owner | admin`
- `customers` — customer profile extension; `organization_type` enum: `school | religious | corporate | event_planner | individual`
- `bus_owners` — owner profile; `verification_status` lifecycle: `pending → approved | rejected | suspended`
- `OtpToken` — Email OTP token store with expiry enforcement and max-attempt limiting; OTP codes are delivered via Brevo transactional email
- `AdminRole` — admin sub-role assignment: `SUPER_ADMIN | MODERATOR | FINANCE_ADMIN | SUPPORT_ADMIN`
- `AdminPermission` — granular permission records per admin user, enforced at route level

**Fleet & Inventory**
- `vehicles` — core listing entity; `vehicle_type` enum (implemented): `ORDINARY | SEMI_LUXURY | LUXURY_AC`; pricing fields: `base_price_per_km`, `base_price_per_day`, `driver_allowance_per_day`
- `vehicle_photos` — Supabase Storage URL references; `is_primary` flag; `photo_type` enum: `exterior | interior | seats | dashboard | other`
- `amenities` + `vehicle_amenities` — normalized M:N amenity mapping
- `vehicle_availability` — date-range blocking calendar
- `owner_documents` + `vehicle_documents` — document store with `verification_status` per document

**Trip Packages**
- `TripPackage` — owner-defined fixed-price packages: route, vehicle, schedule, all-inclusive price; bookable directly by customers bypassing the quotation flow

**Trip & Quotation Pipeline**
- `trips` — customer-planned trip plan; trip-level fields stored once (pickup/dropoff with coordinates, date range, start time, passenger count, vehicle-type preference, AC flag, special requests, intermediate stops as JSON, OSRM-derived distance/duration estimates); `status` enum: `PLANNING | AWAITING_QUOTES | CONFIRMED | COMPLETED | CANCELLED | EXPIRED`. Single source of truth for trip details; multiple vehicle quotations attach to one trip via `Quotation.tripId`.
- `quotations` — both the customer's per-vehicle request and the owner's response live in this single table. Each row carries a `tripId` (nullable for legacy rows; required for new requests). Owner response columns: full cost breakdown stored as discrete columns plus a `customItems` JSON field; `validity_period` with `expires_at` enforcement; `status` enum: `PENDING | SENT | VIEWED | ACCEPTED | REJECTED | EXPIRED`. The original `quotation_requests` concept described in earlier revisions is realised by the `Quotation` rows with `status = PENDING` plus their parent `Trip`.
- `itinerary_stops` / `itinerary_routes` — PostGIS-backed ordered stops and OSRM-cached route geometry, keyed on `quotationId`. Trip-level itinerary captured as JSON on `trips.itineraryStops` / `trips.itineraryRoute` to avoid duplicating PostGIS tables for the trip-level snapshot.

**Transaction**
- `bookings` — confirmed transaction; `booking_status` enum (implemented): `PENDING | CONFIRMED | ONGOING | COMPLETED | CANCELLED`. *Roadmap:* `DISPUTED` as an additional status.
- `booking_itinerary` — immutable snapshot of itinerary at time of booking
- `bookings` (driver fields) — `driver_name`, `driver_license`, `driver_contact` stored directly on the booking record
- `payments` — payment record; `payment_method` enum: `credit_card | debit_card | bank_transfer | cash | other`; `payment_status` lifecycle: `pending → processing → completed | failed | refunded | cancelled`
- `payment_receipts` — uploaded receipt documents for bank transfer and cash payments (Supabase Storage URLs)
- `Settlement` + `SettlementBooking` — admin-managed batch payout model; `Settlement` groups multiple `SettlementBooking` line items for bulk owner disbursement; bank account details encrypted at rest via `settlementBankEncryption.ts`. *Note: per-transaction automatic `payment_splits` ledger entries (owner | platform | driver) are a roadmap item for a finer-grained audit trail.*

**Trust & Communication**
- `reviews` — aggregate star rating (1–5) + free-text; booking-linked for verified flag. *Roadmap:* sub-dimension columns (vehicle condition, driver behavior, punctuality, cleanliness, value for money).
- `conversations` + `messages` — in-platform customer ↔ owner messaging. `Conversation.bookingId` is `@unique` (1-to-1 with `Booking`); the owner is derived through `Booking → Vehicle → ownerId` rather than denormalized on the conversation. `Message` carries `senderId`, `content`, `readAt`, plus `(conversationId, createdAt)` index for thread paging. `Conversation.lastMessageAt` is denormalized for efficient list sorting.
- `DisputeMessage` — structured message thread scoped to a dispute; accessible to involved parties and admin
- `notifications` — multi-channel delivery log: `in_app | email | push`; `delivery_status`: `pending | sent | delivered | failed`
- `disputes` — dispute lifecycle: `OPEN → INVESTIGATING → RESOLVED | CLOSED | ESCALATED`; `priority`: `low | medium | high | urgent`

**Platform Operations**
- `system_settings` / `PlatformConfig` / `PlatformSettings` — runtime key-value configuration stores (two overlapping stores exist; consolidation is a housekeeping item)
- `audit_logs` — immutable action log (create / update / delete / login / logout / payment / booking events) with old/new value snapshots, IP address, user agent
- `analytics_events` — behavioral event stream: device type, session ID, page URL, event category
- `commission_rules` — configurable commission engine: `percentage | fixed | tiered` modes with booking amount brackets and effective date ranges
- `ScheduledReport` + `ScheduledReportRun` — configurable report schedule definitions and their execution history
- `Testimonial`, `PopularRoute`, `TrustedPartner`, `PlatformStat` — CMS-managed landing page content models
- `ContactMessage` — persisted contact form submissions with admin visibility

### Core Data Flow: Trip-to-Booking

```
1. Customer plans a Trip
   → Customer fills the trip form (pickup, dropoff, dates, passengers, stops)
   → Trip created with status = PLANNING; OSRM-derived distance/duration cached on row
   → Redis checked for cached OSRM result keyed by coordinate pair before any outbound call

2. Customer requests Quotations for the Trip
   → For each vehicle the customer adds, a Quotation row is created with status = PENDING
     and tripId = <Trip.id>
   → Trip status flips from PLANNING → AWAITING_QUOTES on first attached quotation
   → If the customer reaches the new-quotation form with an active trip in flight, the
     UI prompts them to attach to the existing trip (pre-filling all trip fields) or
     start a new one — no implicit defaulting

3. System surfaces the request to eligible owners
   (filtered by base_location, availability, vehicle_type_preference)
   → Redis: eligible owner set cached to avoid redundant DB queries on re-render

4. Owner generates Quotation (manual pricing — current)
   → Owner enters: vehicle_rental_cost, driver_cost, fuel_cost, toll_charges, permit_fees, other_charges
   → [Roadmap: OSRM distance pre-populates base cost via (Distance × rate/km) + driver_allowance]
   → AI Pricing Suggestions endpoint consulted as optional hint
   → Quotation stored with expires_at = created_at + validity_period

5. Customer compares Quotations under the Trip → selects one → initiates Booking
   → Booking created with status: PENDING (awaiting owner confirmation)
   → Trip status flips AWAITING_QUOTES → CONFIRMED on quotation acceptance

6. Owner confirms → Booking status: CONFIRMED
   → Customer redirected to payment (PayHere / bank transfer / cash)

7. Payment completed
   → PayHere: MD5-signed webhook callback received and verified → payment_status: completed
   → Bank transfer / Cash: receipt uploaded → admin or owner manually confirms
   → booking_status → ONGOING (on trip start) → COMPLETED
   → vehicle_availability blocked for booking date range
   → Settlement record updated / new SettlementBooking line item created
   → [Roadmap: per-transaction payment_splits records created for owner | platform | driver]
   → In-app Notification records created for both parties
   → [Roadmap: Transactional email dispatched via Brevo SMTP (nodemailer) to both owner and customer]
   → Digital invoice generated
```

### Service Layer Architecture

Nine service classes implement the domain logic, each implementing a corresponding interface:

- `TripService` — customer trip CRUD, status lifecycle transitions (PLANNING → AWAITING_QUOTES → CONFIRMED / CANCELLED / EXPIRED), and the active-trips lookup that drives the New Quotation attach-to-trip prompt
- `AuthenticationService` — JWT lifecycle, Email OTP generation/verification (delivered via Brevo), OAuth callback handling
- `PaymentService` — PayHere integration (MD5 signing), bank transfer / cash confirmation, refund processing, commission calculation
- `NotificationService` — multi-channel dispatch: in-app notification records (implemented); transactional email via Brevo SMTP/nodemailer (roadmap templates)
- `GeocodingService` — OSRM public API wrapper (route display, distance computation; Distance Matrix / Table Service for auto-pricing is roadmap); Redis cache layer for OSRM responses
- `StorageService` — Supabase Storage presigned URL generation, file upload/delete
- `SearchService` — vehicle search with multi-parameter filter chain (capacity, amenities, price, location, district, date range, sort, pagination)
- `QuotationService` — quotation generation, pricing calculation, AI suggestions endpoint, comparison result construction
- `BookingService` — booking state machine management (PENDING → CONFIRMED → ONGOING → COMPLETED / CANCELLED)

Controllers expose REST endpoints per domain:
`AuthController`, `VehicleController`, `BookingController`, `PaymentController`, `ReviewController`, `AdminController`, `AnalyticsController`, `TripPackageController`

---

## Integration Points

| Service | Provider | Integration Method | Status |
|---|---|---|---|
| Routing & Distance | OSRM (public API — `router.project-osrm.org`) | REST HTTP — `/route/v1/driving/`, `/table/v1/driving/` | Implemented for route display; Table Service for auto-pricing is roadmap |
| Payment Gateway | PayHere (LK) | REST API + MD5-signed webhook callback | Implemented (sandbox + live) |
| Transactional Email / OTP | Brevo SMTP | SMTP via nodemailer (`smtp-relay.brevo.com:587`) | Configured; transactional email templates are roadmap; free tier: 300 emails/day |
| File Storage | Supabase Storage | `@supabase/supabase-js` SDK | Implemented; `travenest` bucket; private access via presigned URLs |
| OAuth | Google + Facebook | Passport.js strategy (OAuth 2.0) | Implemented |
| Error Tracking | GlitchTip (self-hosted, Docker) | Sentry SDK DSN pointed to self-hosted instance | Self-hosted; no SDK change from prior Sentry integration |

**PayHere Webhook Dependency:** The backend exposes `/payments/webhook`. PayHere's webhook payload is verified via MD5 hash before any booking status mutation. Failure or delay in webhook delivery creates a window where payment is processed but booking remains unconfirmed — requiring retry logic and dead-letter handling as a hardening item.

**OSRM Public API Usage Note:** The public OSRM demo server (`router.project-osrm.org`) is provided for testing and low-volume use. It has no formal SLA and imposes rate limits on heavy traffic. Redis caching of all OSRM responses (keyed by coordinate pair, TTL 24 hours) is mandatory to stay within acceptable request volumes. If request volume exceeds the public API's tolerance, a self-hosted OSRM instance processing the Sri Lanka OSM PBF extract (~50 MB, ~512 MB RAM) is the zero-cost fallback.

**Brevo Email Volume:** The Brevo free tier allows 300 transactional emails per day with no expiry. This is sufficient for early production (OTP delivery, booking confirmations, notifications). If daily volume exceeds 300, the Brevo Starter plan ($25/month for 20,000 emails/month) is the upgrade path.

---

## Security & Scalability Considerations

### Security

**Authentication & Session Management**
- JWT tokens with refresh token rotation. `tokenVersion` field on the `User` model is incremented on password change, immediately invalidating all previously issued tokens for that user without a token blocklist.
- **Email OTP** tokens generated server-side with expiry enforcement and max-attempt limiting (`OtpToken` model). OTP codes are delivered exclusively via Brevo transactional email through the `nodemailer` SMTP transport. No SMS channel is used.
- Passwords hashed with bcrypt.
- OAuth 2.0 (Google, Facebook) via Passport.js; OAuth state parameter validated to prevent CSRF on the callback.

**Transport Security**
- TLS 1.2+ enforced on all client-server communication via Nginx + Let's Encrypt (Certbot).
- HTTPS-only; HTTP redirected at Nginx reverse proxy level.

**Request-Level Hardening (Implemented)**
- **CSRF:** Double-submit cookie pattern implemented via `middleware/csrf.ts` on all mutating routes.
- **Helmet:** Security response headers applied globally (X-Frame-Options, CSP, HSTS, etc.).
- **CORS:** Configured with `credentials: true`; origin whitelist enforced.
- **Rate Limiting:** Global limit of 100 requests / 15 minutes per IP; stricter auth-route limit of 10 requests / 15 minutes per IP (`express-rate-limit` backed by self-hosted Redis).
- **Input Validation:** Zod schema validation applied across all API endpoints before business logic execution.
- **RBAC Middleware:** Route-level guards — `isCustomer`, `isVehicleOwner`, `isAdmin`, and admin sub-role checks — enforce access control per endpoint.

**Data Integrity**
- All financial state transitions (payment status, booking status) must be atomic database transactions to prevent race conditions (e.g., double-booking, split payment inconsistency).
- Audit log (`audit_logs` table) captures all mutating operations with old/new value snapshots, IP address, and user agent — satisfies non-repudiation requirement for dispute resolution.
- **PayHere Webhook Signature:** MD5 hash verification implemented before any payment or booking state is mutated on webhook receipt.

**Data Privacy & Encryption**
- PII handling must comply with applicable Sri Lankan data protection obligations.
- Supabase Storage bucket is private; all asset URLs are time-limited presigned URLs generated server-side — raw bucket is not publicly accessible.
- **Settlement Bank Field Encryption:** Owner bank account details stored in settlement records are encrypted at rest via `packages/database/src/settlementBankEncryption.ts`.

### Scalability

**Current Architecture Constraints**
- **Modular monolith** is appropriate for the current load target (500 concurrent users). Vertical scaling (larger instance) is the primary scaling lever before architectural decomposition is warranted.
- **PostgreSQL** is the single point of contention at scale. Read replicas should be introduced before write throughput becomes a bottleneck. Connection pooling (PgBouncer) is recommended from initial deployment.
- **Next.js SSG** pages for static content (homepage, listing pages) reduce backend load; Supabase Storage scales independently.

**Horizontal Scaling Path**
The modular monolith design — with domain separation across Auth, Booking, Vehicle, Payment, Notification, and Admin modules — allows extraction of high-load modules (e.g., Notification, Search) into independent services if load targets exceed single-instance capacity. This path is not required for the stated 500-user concurrent target.

**Performance Targets**
- Initial content load: < 2 seconds on 4G networks
- Concurrent user capacity: ≥ 500 (peak season)
- Uptime SLA: ≥ 99.9%

**Caching Strategy (Self-Hosted Redis via Docker)**

Redis OSS (`redis:7-alpine`) is the application-level caching layer, running as a Docker container with AOF persistence enabled.

| Cache Target | Key Pattern | TTL | Rationale |
|---|---|---|---|
| OSRM distance / route results | `osrm:dist:{origin_hash}:{dest_hash}` | 24 hours | Prevents redundant outbound calls to the public OSRM API; mandatory given the absence of a formal SLA on the public endpoint |
| Vehicle search results | `search:{filter_hash}:{page}` | 5 minutes | Reduces DB load on high-traffic listing pages |
| Rate limiter counters | `rl:{ip}:{route}` | Per window (15 min) | Backing store for `express-rate-limit` |
| OTP attempt counters | `otp:attempts:{userId}` | Per OTP TTL | Enforces max-attempt policy without a synchronous DB write per attempt |

Redis is also usable as the backing store for WebSocket session state when real-time notification delivery is implemented. The current Socket.IO server is single-instance (in-memory adapter); migrating to the Redis adapter is required before scaling the API horizontally.

**Database Indexing**
Critical indexes required on high-query paths: `vehicles(owner_id, is_active, vehicle_type)`, `vehicle_availability(vehicle_id, start_date, end_date)`, `quotation_requests(customer_id, status)`, `bookings(customer_id, owner_id, booking_status)`, `payments(booking_id, payment_status)`.

**Observability**

- **Structured Logging (Pino):** All backend modules emit structured JSON logs via Pino. Log levels (debug / info / warn / error) are environment-controlled. Logs are collected by the hosting platform's log aggregation pipeline or written to stdout for Docker log driver capture.
- **Error Tracking (GlitchTip — self-hosted Docker):** GlitchTip runs as a Docker container (`glitchtip/glitchtip`) on the production host. The existing Sentry SDK in both `apps/api` and `apps/web` requires no code change — only the `SENTRY_DSN` environment variable is updated to point to the self-hosted GlitchTip instance. Unhandled exceptions, rejected promises, and explicit `captureException()` calls are routed to GlitchTip with environment tagging (development / staging / production). GlitchTip stores error event data in PostgreSQL (shared instance, dedicated schema).
- **Health Check Endpoint:** A `GET /health` endpoint should be exposed for hosting platform readiness and liveness probes. [Requires Clarification — not yet confirmed in codebase]
- **Metrics:** Application-level metrics (request throughput, error rate, response time) are derived from GlitchTip performance monitoring and hosting platform native metrics. A dedicated metrics stack (Prometheus + Grafana) is not required at current scale.
