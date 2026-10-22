# TraveNest — Autonomous Agent System Rules

> This file governs all autonomous AI coding agents operating in this repository.
> Violation of any rule in this document constitutes a failed task, regardless of
> whether the output compiles or passes tests.

---

## 1. Prime Directive

**`context.md`, `architecture.md`, and `TravelNest-Design-System.md` are the absolute, non-negotiable sources of truth for this repository.**

Before you write a single line of code, generate a file, modify a schema, or propose a solution, you must have read all three documents in their entirety during the current execution context. If they are not in your context window, load them now. There are no exceptions.

These documents define:

- **`context.md`** — the business domain, user segments, feature scope (MVP vs. roadmap), success metrics, and what is explicitly out-of-scope.
- **`architecture.md`** — the canonical technology stack, data models, service layer contracts, integration points, security posture, caching strategy, and observability requirements.
- **`TravelNest-Design-System.md`** — the canonical UI/UX specification: color tokens, typography scale, grid system, border radius rules, component inventory, motion system, accessibility standards, imagery guidelines, and copywriting voice. All frontend output must be traceable to this document.

Any code, suggestion, schema change, or UI/UX decision you produce that cannot be directly traced to a statement in one of these three documents is unauthorized and must not be emitted.

---

## 2. The Verification Protocol (Pre-Flight Check)

You must execute the following verification sequence before proposing any substantive output:

### Step 1 — Load the Source Documents
Confirm that `context.md`, `architecture.md`, and `TravelNest-Design-System.md` are present in your active context. If not, read them from the repository root before proceeding.

### Step 2 — Classify the Request
Determine which of the following applies to the user's request:

| Classification | Definition |
|---|---|
| **In-Scope / Implemented** | The feature is listed as MVP in `context.md` and has a corresponding service, controller, or schema entry in `architecture.md` |
| **In-Scope / Roadmap** | The feature is explicitly marked as *Roadmap* in `context.md`. It is scoped but **not yet implemented**. |
| **Out-of-Scope** | The feature is listed under "Out-of-Scope" in `context.md` or has no basis in either document. |
| **Contradictory** | The request conflicts with a stated design decision (e.g., asks to use a different ORM, database, auth method, or design token). |

### Step 3 — State Your Alignment
Before outputting any code, produce a brief alignment statement (2–5 sentences) that explicitly maps your proposed solution to the architecture and, for frontend work, to the design system. Name the specific module, service class, controller, data model, or design system component your output touches. If you cannot name one, stop and ask the user for clarification.

**Example alignment statement (backend):**
> "This task touches `modules/quotation/quotation.service.ts` and the `Quotation` Prisma model. The expiry logic I am adding uses the existing `validUntil` / `validityDays` fields described in `architecture.md`. No new libraries are introduced. No schema migration is required."

**Example alignment statement (frontend):**
> "This task renders a `BusCard` component as defined in `TravelNest-Design-System.md §5.6`. I am using `--radius-card` (20px), `--color-action-primary` for the CTA button, the `text-heading-md` type token for the route title, and `spring-smooth` for the card hover lift. No new design tokens or components are introduced."

### Step 4 — Confirm Roadmap Boundary
If your task involves a roadmap feature (e.g., Redis caching, Pino logging, Sentry, `DISPUTED` booking status, `payment_splits` ledger, scheduled-report automation), you must explicitly state that this is a roadmap item and confirm the user has authorized its implementation before writing any code.

---

## 3. Execution Rules

These rules are mandatory. They are not suggestions.

### 3.1 Repository Structure
- The repository is a **pnpm monorepo**. Workspaces are `apps/api`, `apps/web`, and `packages/` (`database`, `shared-types`).
- All backend domain logic lives in `apps/api/src/modules/<domain>/`. Do not create logic outside this pattern.
- All Prisma schema and migrations live in `packages/database/`. Do not place schema definitions elsewhere.
- Shared TypeScript types belong in `packages/shared-types/`. Do not duplicate type definitions across `apps/`.

### 3.2 Technology Stack — No Deviations
You must use only the technologies listed in `architecture.md`. Specifically:

| Concern | Canonical Choice | Do Not Substitute With |
|---|---|---|
| Backend framework | Express.js | Fastify, Hono, NestJS, or any other |
| ORM | Prisma | TypeORM, Drizzle, raw SQL (unless Prisma cannot express it) |
| Frontend framework | Next.js 16 (React 19) | Remix, Vite+React, Astro, or any other |
| Styling | Tailwind CSS 4 | CSS Modules, styled-components, Emotion |
| Animation | `motion/react` | Framer Motion (separate package), CSS keyframes for spring interactions |
| Icons | `lucide-react` | Heroicons, Font Awesome, custom SVGs not in Lucide |
| Database | PostgreSQL 16 + PostGIS | MySQL, MongoDB, SQLite |
| Auth | JWT cookies + bcryptjs + email OTP + hand-rolled Google/Facebook OAuth (`modules/auth`) | Passport.js, NextAuth, Auth.js, Clerk, Firebase Auth |
| File Storage | Supabase Storage (`apps/api/src/utils/storage.ts`) | AWS S3, Cloudinary, UploadThing |
| Payment | PayHere | Stripe, PayPal, Razorpay |
| Validation | Zod (`middleware/validate.ts`) | Joi, Yup, class-validator, express-validator (installed but unused) |
| Email | Brevo SMTP via nodemailer | SendGrid, AWS SES, Resend |
| Realtime | Socket.IO (`apps/api/src/realtime/socket.ts`) | Pusher, Ably, raw `ws` |
| Routing / distance | Self-hosted OSRM | Google Maps / Distance Matrix |
| Maps / geocoding | Leaflet + OpenStreetMap tiles, Nominatim | Google Maps, Mapbox |
| Client state | zustand | Redux, MobX |
| Background jobs | In-process `setInterval` in `apps/api/src/jobs/` | BullMQ, node-cron, external schedulers |
| Logging | Morgan + `console` with `[module]` prefix (Pino is roadmap) | Winston, Bunyan |
| Error Tracking | None yet — Sentry Developer free tier is roadmap | Datadog, Rollbar, Bugsnag |
| Caching | None yet — Redis is roadmap | Memcached, in-process LRU cache for shared state |

**Do not introduce any new npm package without explicitly asking the user first and receiving confirmation.** State the package name, its purpose, and which existing tool it would supplement or replace.

### 3.3 Database Schema Rules
- **Do not alter the Prisma schema or generate a migration unless explicitly commanded by the user.**
- When a schema change is required, describe the exact model change, the migration impact, and any data-backfill requirements before executing.
- Respect all canonical enum values (source: `packages/database/prisma/schema.prisma`). Key enums:
  - `VehicleType`: `ORDINARY | SEMI_LUXURY | LUXURY_AC`
  - `BookingStatus`: `PENDING | CONFIRMED | ONGOING | COMPLETED | CANCELLED` (note: `DISPUTED` is roadmap — do not add it without a migration command)
  - `QuotationStatus`: `PENDING | SENT | VIEWED | ACCEPTED | REJECTED | EXPIRED`
  - `TripStatus`: `PLANNING | AWAITING_QUOTES | CONFIRMED | COMPLETED | CANCELLED | EXPIRED`
  - `UserRole`: `CUSTOMER | VEHICLE_OWNER | ADMIN`; `UserStatus`: `ACTIVE | INACTIVE | SUSPENDED | PENDING_VERIFICATION`
  - `AdminRole`: `SUPER_ADMIN | MODERATOR | FINANCE_ADMIN | SUPPORT_ADMIN`
  - `PaymentStatus`: `PENDING | PROCESSING | COMPLETED | FAILED | REFUNDED` (`Payment.method` is a free string: card / bank transfer / cash)
  - `DocumentType`: `NIC | DRIVING_LICENSE | INSURANCE | REGISTRATION_CERTIFICATE | PROFILE_PHOTO | VEHICLE_PHOTO`; `DocumentStatus`: `PENDING | VERIFIED | REJECTED`
  - `DisputeType`: `BOOKING_QUALITY_ISSUE | CANCELLATION_DISPUTE | PAYMENT_ISSUE | VEHICLE_CONDITION | BEHAVIOR_COMPLAINT | SERVICE_NOT_PROVIDED | OTHER`; `DisputeStatus`: `OPEN | INVESTIGATING | RESOLVED | CLOSED | ESCALATED`; `DisputePriority`: `LOW | MEDIUM | HIGH | URGENT`
  - `SettlementStatus`: `PENDING | PROCESSING | COMPLETED | FAILED | CANCELLED`; `CommissionType`: `PERCENTAGE | FIXED | TIERED`
  - `PlatformNotificationChannel`: `IN_APP | EMAIL | SMS` (SMS has no provider — out of scope)
  - `DriverStatus`: `ACTIVE | INACTIVE`; `VehiclePhotoTag`: `EXTERIOR | INTERIOR | FRONT | REAR | SEATS | OTHER`
- Already implemented — do not re-create: review sub-ratings (6 dimensions), `Conversation`/`Message` messaging tables, `Driver`, `OwnerBankAccount`, `Trip`, PostGIS itinerary tables.
- PostGIS objects (extension, `vehicles.geom` trigger, GIST indexes) must be created in raw-SQL migrations. Never rely on `prisma db push` for them.

### 3.4 Security Rules — Non-Negotiable
Every output that touches an API endpoint, middleware, or data mutation must satisfy all of the following:

1. **Zod validation** must be applied to all incoming request bodies and query parameters before business logic executes.
2. **RBAC middleware** (`isCustomer`, `isVehicleOwner`, `isAdmin`, admin sub-role guards) must be applied to every protected route. Never leave a mutating route without a role guard.
3. **CSRF protection** (double-submit cookie via `middleware/csrf.ts`) must remain on all mutating routes. Do not remove or bypass it.
4. **All financial state transitions** (payment status changes, booking status changes, settlement mutations) must be wrapped in a Prisma `$transaction()` call. No multi-step financial mutation may be non-atomic.
5. **PayHere webhook handler** must verify the MD5 signature before mutating any booking or payment record. Do not remove or weaken this check.
6. **Supabase Storage** uploads go through `apps/api/src/utils/storage.ts`. Sensitive files (owner/vehicle documents, receipts) must use `uploadPrivateBuffer` (private bucket, signed URLs; ADR-001); only photos and avatars use the public bucket.
7. **Settlement and owner bank account fields** must remain encrypted via `packages/database/src/settlementBankEncryption.ts`. Do not store raw bank account strings.
8. **Rate limiting** must remain configured on auth routes (10 req / 15 min) and globally (100 req / 15 min). It is enforced only when `NODE_ENV=production`; do not remove the production enforcement or raise limits without explicit user instruction.
9. **Do not log PII** (user passwords, OTP values, bank account details, NIC numbers, payment card data) at any log level. (The existing OTP console print in `auth.service.ts` is a known gap to be restricted to development.)

### 3.5 Service Layer Contracts
Each domain operation must be implemented in the appropriate module service, not in controllers or route handlers directly. Services are function-based modules (`export const fn = async (...)`), one per domain: `modules/<domain>/<domain>.service.ts` — `auth`, `user`, `owner`, `vehicle` (incl. radius search), `driver`, `trip`, `quotation`, `booking`, `trip-package`, `payment` (+ `settlement.service.ts`), `review`, `dispute`, `message`, `notification` (+ `email.service.ts`), `routing` (OSRM), `landing`, `content`, and the admin sub-modules under `modules/admin/`. Shared storage helpers live in `apps/api/src/utils/storage.ts`.

Controllers expose HTTP endpoints and delegate to services. Business logic does not belong in controllers. Route handlers do not contain direct Prisma queries.

### 3.6 Caching (Roadmap)
There is **no cache layer today**. Redis is a roadmap item and must not be introduced without user approval. When it is authorized, use the key patterns in `architecture.md § Scalability`:

| Target | Key Pattern | TTL |
|---|---|---|
| OSRM route results | `osrm:route:{coords_hash}` | 24 hours |
| Vehicle search results | `search:{filter_hash}:{page}` | 5 minutes |
| Rate limiter counters | `rl:{ip}:{route}` | 15 minutes |

Do not invent new key patterns without documenting them and confirming with the user. Note that quotation routes are already persisted in PostGIS (`itinerary_routes`), so views must read stored geometry rather than re-calling OSRM.

### 3.7 Internationalization
The frontend supports three locales: `en`, `si`, `ta` (files in `apps/web/src/i18n/locales/`). All user-facing strings must be sourced from locale JSON files via `next-intl`, with keys added to all three locales. Do not hardcode English strings into JSX output unless instructed. Exception: the admin portal is English-only (no language switcher in admin chrome).

### 3.8 Design System Rules — UI/UX

All frontend output is strictly governed by `TravelNest-Design-System.md`. The following rules are non-negotiable:

#### 3.8.1 Color System
- Use **only the semantic design tokens** defined in `TravelNest-Design-System.md §2`. Do not use arbitrary hex values, Tailwind color utilities (e.g., `blue-500`, `gray-300`), or inline styles for color.
- `--color-action-primary` (`#20B0E9`) is reserved **exclusively** for interactive elements (buttons, links, active states, focus rings). Do not use it for decorative backgrounds, borders, or text that is not interactive.
- The neutral palette (`--color-bg-base`, `--color-bg-surface`, `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--color-border-default`) is the only permitted choice for backgrounds, typography, and borders that are not interactive or semantic.
- Use feedback colors (`--color-success-*`, `--color-error-*`) strictly for validation and alert states.
- **Dark mode is not supported in v1.0.** Do not add `dark:` Tailwind variants or conditional dark-mode logic.
- Tokens must be mapped in the Tailwind `@theme` block as specified in `TravelNest-Design-System.md §11`.

#### 3.8.2 Typography
- The **only permitted font** is `Inter`. Do not introduce other typefaces.
- All text must use one of the six defined type scale tokens: `text-display`, `text-heading-lg`, `text-heading-md`, `text-body-lg`, `text-body`, `text-caption`. Do not introduce arbitrary font sizes.
- Permitted font weights: Regular (400), Medium (500), Semibold (600), Bold (700). No other weights.
- Long text blocks (descriptions, About Us, policies) must be constrained to a `max-w` of `720px` / 60–75 characters per line.

#### 3.8.3 Grid, Layout & Spacing
- Container max-width is `1280px`. Do not exceed it.
- Grid gaps between Bento grid items are `24px`. Do not use arbitrary gap values.
- All spacing must use the **8px modular scale**: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`. Do not use values outside this scale.
- Breakpoints are fixed: Mobile `0–639px` (1 col, `16px` padding), Tablet `640–1023px` (2–4 col, `24px` padding), Desktop `1024–1439px` (12 col, `32px` padding), Wide `1440px+` (12 col, `32px` padding).
- All interactive elements on mobile must have a minimum touch target of **44px × 44px**.

#### 3.8.4 Border Radius — Concentric Radii Principle
You must apply the three-level radius scale defined in `TravelNest-Design-System.md §4.1`. The governing formula is:

```
inner_radius = outer_radius − gap_to_edge
```

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| `--radius-card` | `20px` | `rounded-[20px]` | Cards, panels, search bar container, modals |
| `--radius-interactive` | `12px` | `rounded-xl` | Buttons, inputs, icon badges |
| `--radius-chip` | `8px` | `rounded-lg` | Chips, tags, amenity badges, small overlays |
| (implicit) | `9999px` | `rounded-full` | Circular avatars, step icons, progress bars |

- Do not mix radius levels arbitrarily. Two adjacent elements at the same radius look accidental. A card at `20px` with a pill button at `9999px` looks disjointed.
- The canonical example: search bar outer container `rounded-[20px]` + `p-2` (8px padding) → inner search button `rounded-xl` (12px). `20 − 8 = 12` ✓

#### 3.8.5 Component Inventory
TravelNest defines 40+ canonical components across six categories in `TravelNest-Design-System.md §5`. You must use these components — you may not invent new UI patterns that duplicate an existing component's purpose.

Key components to reference before building:
- **Actions**: `Button` (Primary, Secondary, Ghost — 44px height, `rounded-xl`), `IconButton` (must include `aria-label`), `CTAButton` (4-layer interaction stack — see §6.1), `Badge/Tag`, `Tooltip`
- **Forms**: `TextInput` (44px height), `TextArea`, `SelectDropdown`, `DateRangePicker`, `NumberStepper`, `Checkbox`, `RadioButton`, `Toggle`, `FileUpload`
- **Navigation**: `TopNav` (transparent → solid on scroll), `MobileBottomNav` (sticky, 3–4 destinations), `Breadcrumbs`, `Tabs` (2px `--color-action-primary` bottom border on active), `Pagination`, `Drawer/Sidebar`
- **Feedback**: `AlertBanner`, `ToastNotification` (slide-up snackbar), `Modal/Dialog` (dark backdrop blur, spring scale-in), `SkeletonLoader`, `Spinner/Loader`, `EmptyState` (illustration + conversational copy + CTA)
- **Data Display**: `ImageCarousel/Gallery`, `Accordion/Disclosure`, `Table`, `Bento Feature Grid`
- **Marketplace Domain**: `SearchBar`, `FilterChips` (horizontally scrollable on mobile), `BusCard` (16:9 cinematic image), `SeatSelector/SeatMap`, `PriceBreakdown`, `ReviewCard`, `OwnerProfileCard`, `BookingStepper`, `ItineraryTimeline`

#### 3.8.6 Motion & Animation
- All animations must use `motion/react` with the spring physics tokens defined in `TravelNest-Design-System.md §6`.
- **Motion Restraint Rule:** No more than **one active animated interaction per component** at a time. Do not stack multiple spring animations on a single element simultaneously.
- Spring tokens:
  - `spring-bouncy`: `stiffness: 460, damping: 17` — CTA button arrow and scale effects
  - `spring-smooth`: `stiffness: 300, damping: 30` — layout shifts, card expansions, modals, section reveals
  - `spring-snap`: `stiffness: 350, damping: 45` — CTAButton 4-layer hover stack (critically damped, zero overshoot)
- **`prefers-reduced-motion` is mandatory.** Every spring animation must have a fallback using CSS `transition-colors` or opacity fade. Do not emit animated components without this fallback.
- Do not use CSS `@keyframes` for interactions that are specified as spring physics. Do not use CSS `transition` for layout shifts that are specified as `spring-smooth`.

#### 3.8.7 Icons
- Use **`lucide-react` exclusively**. Do not import icons from other libraries or inline custom SVGs for icons that exist in Lucide.
- Icon sizes: `20px` for inline button contexts, `24px` for standalone or navigation contexts.
- All icon-only interactive elements (hamburger, close X, favorite) **must** include an `aria-label`.

#### 3.8.8 Imagery Standards
- Image aspect ratios: `16:9` for cinematic covers and `BusCard` headers; `4:3` for bus gallery grids.
- Minimum hero image resolution: `1600px` width.
- Format: **WebP** required. Do not use JPEG or PNG for new images unless WebP is not available.
- Next.js `<Image>` component must be used for all images — never a raw `<img>` tag.

#### 3.8.9 Accessibility — Non-Negotiable
- **WCAG AA minimum**: Normal text contrast ratio `4.5:1`; large text and essential icons `3:1`.
- Tab order must strictly match the visual hierarchy. Do not introduce elements that break logical tab flow.
- **Focus states must never be disabled.** Use `focus-visible:ring` (not `focus:ring`) so rings appear only during keyboard navigation.
- All icon-only buttons must have `aria-label`. All form inputs must have associated `<label>` elements.
- Touch targets on mobile: minimum **44px × 44px** for all interactive elements.

#### 3.8.10 Copywriting Voice
All user-facing copy must conform to the TravelNest voice: **Conversational, Warm, Confident, and Local** (Sri Lankan cultural context).

Error message format is mandated as: **Problem + Explanation + Next Step.**
- ✅ Correct: "Oops, no buses are rolling on these dates! Try shifting your trip by a day or two."
- ❌ Wrong: "Error 404: No results found."

Keep business-critical flows (checkout, payment confirmation, dispute resolution) professionally toned. Reserve warmth for discovery, empty states, and success messages.

---

## 4. Anti-Hallucination Guardrails

### 4.1 Roadmap Features
If the user requests implementation of any of the following, you must pause, label the feature as **Roadmap — Not Yet Implemented**, and ask for explicit confirmation before writing any code:

- Redis caching, Redis rate-limit store, Socket.IO Redis adapter
- Pino structured logging; Sentry error tracking
- `DISPUTED` booking status (requires schema migration)
- Per-transaction `payment_splits` ledger records
- Automatic execution of `ScheduledReport` definitions
- Email templates beyond OTP, password reset, booking-confirmed and payment-received
- Production deployment (Vercel + Oracle Cloud VM + Caddy) and activating the CD deploy steps
- Dark mode (explicitly deferred to post-v1.0 per design system)
- Storybook component documentation (referenced in design system governance but not yet established)

The following were roadmap in earlier revisions and are now **implemented** — extend them, do not rebuild them: booking-scoped messaging + Socket.IO delivery, 6-dimension reviews, time-based refund policy, OSRM-based quotation pre-fill, `GET /health`, CI workflows, transactional emails for OTP/reset/booking/payment, driver roster.

### 4.2 Out-of-Scope Requests
If the user asks you to build any of the following, you must refuse and cite `context.md § Out-of-Scope`:

- Native Android or iOS applications
- Scheduled intercity passenger seat ticketing
- Physical fleet operations (maintenance scheduling, fuel logistics). Note: the owner driver roster and per-booking driver assignment are in scope and implemented.
- Platform-managed GPS tracking
- SMS delivery of any kind (Twilio was dropped; OTP is email-only)

### 4.3 Contradictory Architecture or Design Requests
If the user asks you to:
- Switch the database to MongoDB, replace Prisma, or change the payment gateway → cite `architecture.md` and refuse until the document is updated.
- Use a color not in the design token set, introduce a non-Lucide icon library, or use a font other than Inter → cite `TravelNest-Design-System.md` and refuse.
- Use CSS keyframe animations for interactions specified as spring physics → refuse and use `motion/react`.
- Add dark mode variants → refuse; dark mode is not supported in v1.0.
- Disable focus rings or reduce touch targets below 44px → refuse; this is an accessibility violation.

You do not have authority to initiate an architectural or design pivot on your own. The documents must be updated first.

### 4.4 Uncertainty Protocol
If you are uncertain whether a proposed implementation is consistent with `context.md`, `architecture.md`, or `TravelNest-Design-System.md`, you must say so explicitly. Do not emit code that you cannot trace to a documented requirement. The correct response to uncertainty is a clarifying question, not a best-guess implementation.

---

## 5. Output Quality Standards

- Every file you create or modify must be TypeScript (`.ts` / `.tsx`). No plain `.js` files in `apps/` or `packages/`.
- All new API endpoints must have a corresponding Zod schema in the module's `*.schemas.ts` file before the route is registered.
- Error responses must use the project's established error-handling middleware pattern. Do not invent new error response shapes.
- Do not add stray `console.log` debugging to production code paths. Follow the existing logging convention (`console.info` / `console.warn` / `console.error` with a `[module]` prefix, never PII). Do not install Pino without user approval — it is a roadmap item.
- Do not leave TODO comments in code you commit. Either implement the item or document it in `context.md` as a roadmap item.
- Mobile-first responsive design is mandatory for all frontend output. Design for 375px viewport first; scale up with `sm:` / `md:` / `lg:` breakpoints.
- All new frontend components must use the design token set from `@theme` — no hardcoded hex values, no arbitrary Tailwind color classes, no inline `style={{}}` for values expressible with tokens.
- The `CTAButton` component's 4-layer interaction stack (`spring-snap`) must be used for all primary call-to-action buttons. Do not re-implement the hover/tap behavior inline on other elements.
- Next.js `<Image>` must be used for all image rendering. Raw `<img>` tags are not permitted.
