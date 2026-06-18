# Executive Summary

**TravelNest** is a web-based, multi-vendor bus charter marketplace targeting the Sri Lankan group transportation sector. The platform operates as a digital intermediary that connects independent bus owners (supply side) with group travel organizers (demand side), enabling end-to-end charter transactions: discovery, standardized quotation, comparative evaluation, booking, and secure payment. The system is scoped as a Progressive Web App (PWA) to maximize reach without native mobile development overhead. The core value proposition is the elimination of the fragmented, phone-based procurement process currently dominant in the market, replacing it with a transparent, standardized digital workflow.

---

## Problem Statement

The Sri Lankan private bus charter market is structurally fragmented, lacking any centralized digital marketplace. The three quantifiable failure modes of the current market are:

**Supply-side absence from digital platforms:** Existing vehicle-hire platforms (PickMe Rentals) cover small vehicles exclusively; bus categories are absent. Single-company fleet sites (Malkey Rent A Car) provide no multi-vendor comparison. Peer-to-peer platforms (ROFI.lk) support minibuses but lack standardized listing quality and charter-specific tooling.

**Demand-side friction:** Customers sourcing a charter bus — for school trips, pilgrimages, corporate events, or private group travel — must contact multiple operators individually via phone or agent, receiving inconsistent pricing with no itemized cost breakdown, no credential verification, and no comparative interface.

**Structural gaps in existing digital offerings:**

| Gap | Impact |
|---|---|
| No multi-owner bus marketplace | Zero cross-vendor price comparison for charter buses |
| No standardized quotation structure | Opaque pricing; fuel, permits, and driver costs are hidden |
| No owner credential verification layer | No trust signal for customers; regulatory non-compliance risk |
| No integrated payment processing | Transactions remain offline; no receipts, no dispute trail |
| No island-wide aggregation | Supply discovery is geography-limited; operators in rural areas have no digital presence |

The nearest adjacent product, BusSeat.lk, addresses scheduled intercity passenger ticketing — a categorically different service from private charter — leaving the charter segment entirely unaddressed.

---

## Target Audience

**Primary User Segments:**

**Customers (Demand Side)**
- School and academic institutions (excursions, inter-school events)
- Religious organizations (pilgrimages, temple/church event transportation)
- Corporate entities (team offsites, event logistics)
- Private event planners and social group organizers

Characteristic: Occasional, low-frequency users with variable technical literacy. The UI/UX must accommodate non-technical users on mobile devices under real-world network conditions (4G).

**Bus Owners (Supply Side)**
- Individual bus operators with one or more vehicles
- Small-to-medium transport companies with a managed fleet

Characteristic: Require a low-friction onboarding and fleet management workflow. Document upload capability, availability calendar management, and analytics visibility are critical touchpoints.

**System Administrators (Platform Operations)**
- Internal administrators operating under one of four sub-roles: `SUPER_ADMIN` (full platform control), `MODERATOR` (content and user moderation), `FINANCE_ADMIN` (settlements and payouts), `SUPPORT_ADMIN` (dispute resolution and customer support). Permissions are enforced at the route level via a granular `AdminPermission` model.

---

## Key Objectives & Success Metrics

**Objectives:**

1. Build a responsive PWA (mobile-first) eliminating the need for native app development in the initial phase.
2. Implement a verified owner onboarding pipeline including document validation (NIC, business registration, insurance, route permits).
3. Deliver a standardized, all-inclusive quotation engine with transparent cost itemization (vehicle rental + driver allowance + fuel + tolls + permits + agency fee).
4. Provide advanced multi-parameter search and filtering (capacity, AC type, amenities, geographic coverage, price range, rating).
5. Integrate end-to-end booking and payment processing (advance payment via PayHere, digital invoice generation).
6. Support trilingual interfaces: English, Sinhala, Tamil.
7. Deploy on a cost-optimized, self-hosted infrastructure model with defined observability and security baselines.

**Success Metrics (KPIs):**

| Category | Metric | Target |
|---|---|---|
| Supply Growth | Verified bus owner registrations | [Requires Clarification — target number not defined] |
| Demand Growth | Customer quotation requests per month | [Requires Clarification] |
| Transaction | Completed bookings per month | [Requires Clarification] |
| Quality | Average platform review rating | ≥ 4.0 / 5.0 |
| Performance | Page load time on 4G | < 2 seconds (initial content) |
| Reliability | Platform uptime | ≥ 99.9% |
| Concurrency | Concurrent users supported | ≥ 500 (peak season) |
| Business | Platform commission revenue | [Requires Clarification — volume targets not defined] |
| Trust | Owner document verification turnaround | [Requires Clarification] |

*Note: Quantitative business targets (user acquisition, GMV, conversion rates) are not defined in the source documents.*

---

## Scope & Core Features

**In-Scope (MVP):**

**Authentication & User Management**
- Email-based registration with **Email OTP verification** as the primary identity verification channel, delivered via Brevo transactional email. Users must provide a valid email address to register; OTP generation and token storage are implemented server-side with expiry enforcement and max-attempt limiting.
- OAuth Login via Google and Facebook (implemented via Passport.js with OAuth state secret protection; callback page at `/auth/callback`)
- JWT-based session management with refresh token rotation and token-version invalidation (forced logout on password change via `tokenVersion` on the User record)
- Role-based access control: Customer, Bus Owner, Admin (with 4 sub-roles — see Target Audience)
- Password recovery via email link; trilingual language switcher (EN / SI / TA via next-intl)

**Owner Onboarding & Fleet Management**
- Self-registration with document submission (license, insurance, permit, registration, tax)
- Admin-controlled verification workflow (Approve / Reject / Suspend)
- Owner Pending Approval page: real-time document and verification status tracker visible to the owner post-registration, prior to approval
- Vehicle listing creation: capacity (16–50+ seats), vehicle type (see taxonomy below), AC type, amenities, photos (Supabase Storage), base location, operating areas
- Availability calendar management (date blocking)

> **Vehicle Type Taxonomy (Implemented):** The codebase uses a 3-value enum: `ORDINARY` (covering standard and mini-bus capacity range), `SEMI_LUXURY`, and `LUXURY_AC`. The original 4-type design (`mini_bus / standard_bus / luxury_bus / semi_luxury_bus`) from the SRS serves as a reference for future taxonomy refinement if a more granular split is required.

**Search & Discovery**
- Multi-parameter search: pickup/destination (district), dates, passenger count, vehicle type, AC type, amenities, price range, rating, sort order, pagination
- **OSRM** (Open Source Routing Machine) integration for road-based distance computation and route display, consuming the public OSRM API endpoint (*Distance Matrix via OSRM Table Service for automated base cost computation is a roadmap item — see Quotation System*)
- Itinerary builder with intermediate stop support

**Trip Package Module**
- Owner-created fixed-price trip packages defining a pre-set route, vehicle, schedule, and all-inclusive price
- Customers can discover and book packages directly without going through the quotation workflow, reducing friction for common routes
- Packages are managed via the owner portal; customers browse via a dedicated public-facing packages listing

**Trip Planning Module**
- Customers plan a **Trip** once — pickup, dropoff, dates, passengers, vehicle-type preference, AC requirement, intermediate stops, special requests, and OSRM-derived distance/duration estimates — then request as many vehicle quotations under that trip as they wish.
- Trip lifecycle: `PLANNING → AWAITING_QUOTES → CONFIRMED → COMPLETED`, with `CANCELLED` and `EXPIRED` terminal branches. A trip auto-expires if its end date passes with no acceptance.
- Quotations are first-class children of a Trip: every `Quotation` row carries a `tripId`, so customers view received quotations grouped by their trip (rather than the prior frontend-side string-key grouping by pickup/dropoff/date).
- When a customer requests a quotation while an active trip is in flight, the New Quotation flow surfaces a chooser modal — attach to the existing trip (details auto-populate from the trip record) or start a new trip. Customers who arrive directly at a vehicle quotation create an implicit trip from the form they fill in.
- The Customer Dashboard surfaces the active trip as a primary CTA card with the platform's interactive blue when no upcoming booking exists, falling back to a "Plan your first trip" empty state when there are neither bookings nor trips.
- Trip management UI lives under the customer portal at `/dashboard/trips` (list), `/dashboard/trips/new` (plan), and `/dashboard/trips/[id]` (detail with attached quotations and route map). The legacy flat `/dashboard/quotations` route redirects to the trip list; per-quotation detail (`/dashboard/quotations/[id]`) remains linked from the trip detail page.

**Quotation System**
- *Current implementation:* Owners manually enter itemized pricing components (vehicle rental, driver cost, fuel, toll charges, permit fees, other charges) in response to a customer's quotation request. The system stores and displays a full cost breakdown per line item. Quotation requests are attached to a customer-owned `Trip` (see Trip Planning Module).
- *Roadmap:* Automated base-cost computation using `(Distance × rate/km) + driver allowance`, with distance sourced from the **OSRM Table Service API**, pre-populating the owner's quotation form. Results are cached in Redis keyed by origin/destination coordinate pair to eliminate redundant API calls.
- AI Pricing Suggestions: an AI-assisted endpoint provides pricing hints to owners when generating a quotation, based on route and vehicle parameters (implemented; surfacing in UI is a roadmap item)
- Multi-quotation comparison view
- Quotation validity period with `expires_at` enforcement
- Full status lifecycle: `PENDING → SENT → VIEWED → ACCEPTED / REJECTED / EXPIRED`

**Booking & Payment**
- Booking workflow: Quotation acceptance → payment → confirmation
- Booking status lifecycle (implemented): `PENDING` (created, awaiting owner confirmation) → `CONFIRMED` → `ONGOING` → `COMPLETED / CANCELLED`
- *Roadmap:* `DISPUTED` as a distinct booking status (requires a schema migration; disputes currently exist as a separate entity linked to a booking, not as a booking state)
- Driver information tracking: assigned driver name, license number, and contact stored against a booking record
- Payment methods:
  - PayHere (credit/debit card) — primary online gateway with MD5 signature verification and sandbox/live switching
  - Bank transfer — owner manually confirms receipt; customer uploads transfer confirmation document
  - Cash — recorded for on-site settlement scenarios
- Refund processing: full and partial refunds supported
- Advance payment with digital receipt and invoice generation
- Automatic availability calendar update on booking confirmation
- **Email notifications** to both parties via Brevo transactional email (*in-app notification records are implemented; transactional email templates are a roadmap item*)
- *Roadmap:* Time-based cancellation policy enforcement: full refund ≥ 2 weeks prior; 50% refund ≥ 1 week prior. Policy is documented in platform terms but the automated time-check and refund calculation are not yet wired into the cancellation handler.

**Review & Trust**
- *Current implementation:* Single aggregate star rating (1–5) with free-text review, linked to a completed booking (verified flag enforced)
- *Roadmap:* 6-dimension rating breakdown — overall, vehicle condition, driver behavior, punctuality, cleanliness, value for money — requires a schema migration to add sub-dimension columns to the Review model
- Owner response to reviews
- Rating aggregation per vehicle

**In-platform Messaging**
- *Implemented:* Booking-scoped customer ↔ owner messaging. One `Conversation` per `Booking` (1-to-1, enforced by unique constraint) with a `Message` thread. Customers can chat with the assigned bus owner about pickup details, driver contact, and trip logistics; owners use the same thread on their side. Real-time delivery via Socket.IO (see `architecture.md`).
- *Implemented:* Dispute Messaging Thread — structured communication within a dispute via `DisputeMessage`, accessible to involved parties and the assigned admin.

**Dispute Resolution**
- Customer-initiated dispute workflow: types include cancellation, refund, service quality, pricing, vehicle condition
- Dispute lifecycle: `OPEN → INVESTIGATING → RESOLVED / CLOSED / ESCALATED`
- Admin dispute assignment with priority levels (low / medium / high / urgent)
- Structured in-dispute messaging thread (DisputeMessage) for multi-party communication

**Admin Dashboard**
- Owner registration approval queue and document verification (insurance, permits, license)
- User management: suspend, reinstate, delete
- Dispute lifecycle management with internal messaging thread
- Commission rules configuration: `percentage / fixed / tiered` modes with booking amount brackets
- **Settlement & Payout System:** Admin-managed batch payout workflow. `Settlement` records group multiple `SettlementBooking` line items for bulk owner disbursement; accessible under the Financial Management section of the admin portal. Bank account details are encrypted at rest.
- **Scheduled Report Generation:** Configurable report schedules (`ScheduledReport`) with full run history (`ScheduledReportRun`); exports in CSV, PDF, and Excel formats.
- **Marketing Content Management (CMS):** Database-driven management of landing page content — testimonials, popular routes, trusted partners, platform statistics — all editable via the admin portal without a code deployment.
- Platform Config key-value stores (`PlatformConfig` and `PlatformSettings`) for runtime platform behaviour adjustment.
- Immutable audit log with export.
- Analytics: revenue charts, user growth, booking trends.
- Admin sub-role and permission management.

**Owner Analytics Dashboard**
- Owner-facing analytics portal: revenue trends, booking trends, vehicle utilization rates.
- Scoped strictly to the authenticated owner's own fleet and booking history; independent of the admin analytics module.

**Platform Operations**
- Contact Form: public-facing contact submissions are persisted to a `ContactMessage` table with admin visibility.
- CMS-driven landing page: featured vehicles, popular routes/packages, testimonials, trust indicators, and platform stats are managed via the admin CMS rather than hardcoded in the application.

**Out-of-Scope (Current Phase):**
- Native Android/iOS application development
- Scheduled intercity passenger seat ticketing
- Physical fleet operations (maintenance, driver scheduling, fuel logistics)
- GPS tracking (optional/owner-provided only; not platform-managed)
- SMS notifications (removed; all notification delivery is via email and in-app channels)
