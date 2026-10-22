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
2. Implement a verified owner onboarding pipeline with per-document admin review (NIC, driving licence, insurance, vehicle registration certificate, profile and vehicle photos).
3. Deliver a standardized, all-inclusive quotation engine with transparent cost itemization (vehicle rental + driver cost + fuel + tolls + permits + custom items + tax), pre-filled from platform-set rates and road distance.
4. Provide multi-parameter search and filtering (location with nearby-city radius matching, dates, capacity, vehicle type, AC type, amenities, price range, rating).
5. Integrate end-to-end booking and payment processing (PayHere card payments, bank transfer, cash; refunds; printable invoices).
6. Support trilingual interfaces: English, Sinhala, Tamil.
7. Run on **free-forever infrastructure tiers** (Vercel Hobby, Oracle Cloud Always Free, free Postgres, Supabase Storage, Brevo, self-hosted OSRM) with defined security baselines.

**Success Metrics (KPIs):**

| Category | Metric | Target |
|---|---|---|
| Supply Growth | Verified bus owner registrations | [Requires Clarification: target number not defined] |
| Demand Growth | Customer quotation requests per month | [Requires Clarification] |
| Transaction | Completed bookings per month | [Requires Clarification] |
| Quality | Average platform review rating | ≥ 4.0 / 5.0 |
| Performance | Page load time on 4G | < 2 seconds (initial content) |
| Reliability | Platform uptime | ≥ 99.9% (best effort on free tiers) |
| Concurrency | Concurrent users supported | ≥ 500 (peak season) |
| Business | Platform commission revenue | [Requires Clarification: volume targets not defined] |
| Trust | Owner document verification turnaround | [Requires Clarification] |

*Note: Quantitative business targets (user acquisition, GMV, conversion rates) are not defined in the source documents.*

---

## Scope & Core Features

Status markers: features below are **implemented** unless marked *Roadmap*.

**In-Scope (MVP):**

**Authentication & User Management**
- Email + password registration and login, with account lockout after repeated failed attempts.
- **Passwordless Email OTP login** and OTP-verified registration. Codes are hashed, time-limited, attempt-limited and throttled per address, and delivered by Brevo transactional email. Registration (customer and owner) requires the short-lived proof returned when the registration OTP is verified. Login and OTP-login responses do not reveal whether an email has an account.
- Google and Facebook OAuth via a direct OAuth 2.0 implementation (signed `state`; callback page `/auth/callback`). Passport.js is not used.
- JWT session cookies with refresh-token rotation and `tokenVersion` invalidation (password change logs out all sessions).
- Password reset via emailed single-use link; change password; avatar upload.
- **Account removal (soft delete):** customers and owners can remove their account when nothing is pending (no active bookings, open disputes, unpaid payouts or open quotations). Removal keeps past trips and payments for the other party and for admins, frees the email for a new registration and ends all sessions. An owner's vehicles, packages and drivers are removed with the account. Users can ask support to erase all of their data from account settings ("Request full data deletion").
- Role-based access control: Customer, Bus Owner, Admin (4 sub-roles plus granular permissions).
- Trilingual language switcher (EN / SI / TA) on public, customer and owner surfaces. The admin portal is English-only.

**Owner Onboarding & Fleet Management**
- Self-registration with business details and document uploads. Identity and vehicle documents (and bank-transfer receipts) are stored in a private bucket and shown only to the owner and admins through short-lived signed links.
- Admin verification: approve, reject or request resubmission per owner, plus approve/reject per document.
- Owner Pending Approval page showing document and verification status before approval.
- Vehicle listings: type (see taxonomy), AC type (`full-ac | ac | non-ac`), seats, brand/model/year, fuel, transmission, amenities from an admin-managed catalogue, tagged photos (exterior / interior / front / rear / seats / other), documents, base location with coordinates.
- Vehicle activation: owners submit a vehicle for review (`request-activation`) and can withdraw it; admins approve or reject vehicles and their documents.
- **Platform-set pricing:** base rates (per day, per km, fuel cost per km) are set by admins per vehicle type in platform settings. Owners set only the driver allowance. `LUXURY_AC` vehicles are always `full-ac`.
- Availability calendar with manual date blocking; confirmed bookings block dates automatically.
- **Driver roster:** owners add, edit and deactivate drivers (name, phone, photo) and assign an available driver to each booking.

> **Vehicle Type Taxonomy:** `ORDINARY` (standard and mini-bus range), `SEMI_LUXURY`, `LUXURY_AC`. The SRS's original 4-type split remains a reference for future refinement.

**Search & Discovery**
- Search by pickup/destination, dates, passenger count, vehicle type, AC type, amenities, price range, rating and sort order, with pagination.
- **Progressive nearby-city matching** using PostGIS: exact location first, then vehicles within 10 / 20 / 30 km, then the same district. The result shows which tier matched.
- Location autocomplete and interactive maps using OpenStreetMap (Nominatim geocoding, Leaflet maps).
- Road distance, duration and route geometry from a self-hosted **OSRM** instance; routes for quotations are stored in PostGIS and redrawn from storage.
- Vehicle detail pages with photo gallery, reviews and similar vehicles.

**Trip Package Module**
- Owners create fixed-price packages (route, vehicle, duration, passenger range, all-inclusive price).
- Customers browse packages publicly and book them directly, skipping the quotation workflow.

**Trip Planning Module**
- Customers plan a **Trip** once: pickup, dropoff, dates, start time, round-trip flag, passengers, vehicle-type preference, AC requirement, intermediate stops, special requests, and OSRM distance/duration estimates. They can then request as many vehicle quotations under that trip as they like.
- Trip lifecycle: `PLANNING → AWAITING_QUOTES → CONFIRMED → COMPLETED`, with `CANCELLED` and `EXPIRED` branches. Trips expire automatically when the end date passes with no acceptance.
- When requesting a quotation while an active trip exists, the customer chooses to attach to it or start a new trip.
- The customer dashboard shows the active trip as the primary call to action when there is no upcoming booking.
- UI: `/dashboard/trips` (list), `/dashboard/trips/new`, `/dashboard/trips/[id]` (attached quotations and route map).

**Quotation System**
- Owners respond to requests with an itemized quotation: vehicle rental, driver cost, fuel, tolls, permit fees, custom line items, tax, total, notes and validity period.
- **Auto pre-fill:** the owner's quotation form pre-computes vehicle rental (`platform per-km rate × OSRM trip distance`), fuel (`fuel cost per km × distance`), driver cost and toll defaults. The owner can adjust before sending.
- Side-by-side quotation comparison for customers (`/dashboard/quotations/compare`).
- Validity enforced via `validUntil`; stale quotations expire automatically.
- Lifecycle: `PENDING → SENT → VIEWED → ACCEPTED / REJECTED / EXPIRED`.
- A rule-based pricing-suggestions endpoint exists (`GET /quotations/:id/pricing-suggestions`, based on configured Sri Lankan rate ranges). It is not AI-based and is not currently used by the UI.

**Booking & Payment**
- Accepting a quotation creates the booking as a `PENDING` reserve that holds the vehicle's dates. The owner does not re-confirm. Sibling quotations under the same trip are auto-rejected.
- Booking lifecycle: `PENDING` (reserved, awaiting payment) → `CONFIRMED` (paid) → `ONGOING` (owner starts trip) → `COMPLETED`, or `CANCELLED`.
- Unpaid reserves are released after `autoCancelUnpaidHours` (default 24 h; admin-configurable) and the trip returns to `AWAITING_QUOTES`. Cash and receipt-uploaded bank-transfer reserves are exempt.
- On payment completion, the booking is confirmed, the vehicle calendar is blocked, and the owner's settlement is credited in one database transaction.
- Payment methods:
  - PayHere card payments (MD5-verified webhook; sandbox/live switch; local webhook simulator for development).
  - Bank transfer: platform bank details shown; customer uploads a receipt; a finance admin (SUPER_ADMIN / FINANCE_ADMIN) confirms receipt of the money.
  - Cash: collected on site; the owner confirms it was received ("Confirm cash received").
  - Every confirmation (PayHere webhook, admin, owner) runs the same completion: payment completed, booking confirmed, calendar blocked, settlement credited, in one transaction.
- Time-based refund policy (admin-configurable): 100% refund at least `refundFullHours` before start (default 14 days), `refundPartialPercent`% (default 50%) at least `refundPartialHours` before start (default 7 days), otherwise 0%. Paid card bookings are refunded via the PayHere refund API when configured; otherwise the amount is recorded for admin payout. On a partial or no refund the owner keeps the retained share in their settlement. An owner cancelling a paid booking refunds the customer in full. Admins can also cancel with refund.
- Per-day itinerary for multi-day bookings.
- Driver details (assigned roster driver, phone, licence) shown on the booking.
- Printable booking documents and invoices (browser print to PDF).
- *Roadmap:* `DISPUTED` as a booking status (disputes are a separate entity today).

**Notifications**
- In-app notifications with categories (Bookings, Payments, Quotations, Reviews, System), unread counts, mark-read and delete. They are pushed in real time over Socket.IO.
- Email copies via Brevo for the highest-value events: **booking confirmed** and **payment received**. OTP and password-reset emails are also sent.
- Read notifications are purged after 90 days.
- Admin broadcast notifications to a role or specific users, with resend and delivery analytics.
- *Roadmap:* email templates for the remaining event types.

**Review & Trust**
- Verified reviews (one per completed booking): overall star rating plus **six optional sub-ratings** (vehicle condition, driver behaviour, punctuality, cleanliness, value for money), title, comment and "would recommend".
- Owner public response to reviews; per-vehicle and per-owner rating summaries.
- Admin review moderation.

**In-platform Messaging**
- Booking-scoped customer ↔ owner chat: one conversation per booking, real-time delivery and read receipts over Socket.IO, unread counts.
- Dispute message threads, with admin-only internal notes.

**Dispute Resolution**
- Customers and owners can raise disputes on a booking. Types: booking quality issue, cancellation dispute, payment issue, vehicle condition, behaviour complaint, service not provided, other. Evidence attachments supported.
- Lifecycle: `OPEN → INVESTIGATING → RESOLVED / CLOSED / ESCALATED`; priority `LOW / MEDIUM / HIGH / URGENT`.
- Admin assignment, priority and status changes, messaging and resolution (with resolution type and amount).

**Owner Portal**
- Dashboard (stats, revenue chart, recent reviews).
- Analytics: revenue trends, booking trends, per-vehicle utilization and booking history. Scoped to the owner's own fleet.
- **Earnings:** summary, transaction list and settlement history; payout bank account management (account number encrypted at rest).
- Quotation inbox, sent quotations, bookings, packages, drivers, fleet, messages, notifications, reviews, disputes, profile and settings.

**Admin Dashboard**
- Dashboard with revenue/user/booking charts, activity feed and pending actions.
- Owner and vehicle verification queues with per-document review and verification history.
- User management: view activity, suspend/reinstate, reset password, remove (soft delete, blocked while anything is pending), export; create admins and manage other admin accounts (super admin only). Removed users, vehicles, reviews, FAQs and testimonials stay visible to admins, marked as removed.
- Booking management: status overrides, cancel with refund, export.
- Dispute management, review moderation.
- Finance: commission rules (`PERCENTAGE / FIXED / TIERED`) and owner settlements. Paid bookings accrue automatically into the owner's pending settlement; admins process payouts.
- Reports: definitions for users, bookings, financial, operations, audit, disputes, verifications and system data, exported as CSV, PDF or Excel. Reports run on demand; *Roadmap:* automatic execution of scheduled reports.
- CMS: content pages (privacy, terms, refund policy, etc.), FAQs, testimonials (with approval), amenities catalogue, popular routes, trusted partners, platform stats.
- Platform settings: general, notification, payment, booking (auto-cancel window, refund policy), security, map, vehicle pricing, maintenance mode.
- Immutable audit log for every authenticated mutation (all roles), with export.
- Admin sub-role and permission management; admin profile and activity.

**Public Site**
- CMS-driven landing page (featured vehicles, popular routes, packages, testimonials, partners, stats), about, how it works, FAQ, contact form (stored with a reference ID), privacy, terms, refund policy.
- Public vehicle search, vehicle detail and package pages.

**Out-of-Scope (Current Phase):**
- Native Android/iOS applications.
- Scheduled intercity passenger seat ticketing.
- Physical fleet operations (maintenance, fuel logistics).
- Platform-managed GPS tracking.
- SMS notifications and SMS OTP. All delivery is in-app and email. The `PHONE_VERIFICATION` OTP purpose and `SMS` broadcast channel exist in the schema but are not wired to any provider.
- Dark mode (deferred to post-v1.0 per the design system).

**Roadmap (not yet implemented):**
- Redis caching (search results, OSRM responses), Redis-backed rate limiting and Socket.IO adapter.
- Pino structured logging; Sentry (free Developer tier) error tracking.
- `DISPUTED` booking status.
- Automatic execution of scheduled reports.
- Email templates for all notification types.
- Production deployment (Vercel + Oracle Cloud VM) and an active CD deploy step.
- Storybook component documentation.
