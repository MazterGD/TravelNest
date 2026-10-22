# TraveNest API (`@travenest/api`)

Express 4 modular-monolith backend for the TraveNest bus charter marketplace. It serves the REST API at `/api/v1`, a Socket.IO server at `/socket.io`, and `GET /health`.

For setup (environment variables, PostGIS, OSRM, seeding), see the [root README](../../README.md). For design, see [`architecture.md`](../../architecture.md).

## Commands

Run from the repository root:

```bash
pnpm dev:api                                    # tsx watch on http://localhost:5000
pnpm build:api && pnpm start:api                # production build / run
pnpm test                                       # Vitest + Supertest suite (uses DATABASE_URL)
pnpm --filter @travenest/api lint
pnpm --filter @travenest/api payhere:simulate <bookingId>   # complete a PayHere payment locally
```

## Structure

```
apps/api/
├── scripts/simulatePayhereWebhook.ts   # signed PayHere webhook simulator
├── src/
│   ├── index.ts        # server start, Socket.IO init, background jobs
│   ├── app.ts          # Express app: Helmet, CORS, rate limits, Morgan, routers
│   ├── config/         # env-driven config (loads apps/api/.env and root .env)
│   ├── middleware/     # auth (JWT + roles), csrf, validate (Zod), errorHandler, auditLogger
│   ├── jobs/           # bookingLifecycle (15 min), notificationRetention (daily)
│   ├── realtime/       # Socket.IO server (rooms user:<id>, conversation:<id>)
│   ├── utils/          # response helpers, Supabase storage helpers
│   └── modules/        # <domain>.routes / .controller / .service / .schemas
│       ├── auth  user  owner  vehicle  driver
│       ├── trip  quotation  booking  trip-package  payment
│       ├── review  dispute  message  notification
│       ├── routing  landing  content  uploads
│       └── admin/      # amenities analytics audit bookings content dashboard disputes faqs
│                       # financial notifications profile reports reviews settings
│                       # testimonials users vehicles verifications
└── tests/              # Vitest suites; env set in tests/setup.ts
```

## Routers (`/api/v1/...`)

| Prefix | Covers |
|---|---|
| `/auth` | CSRF token, register, password login, email OTP send/verify, refresh, logout, me, forgot/reset/change password, Google and Facebook OAuth |
| `/users` | Profile, address, avatar, change password, delete account, customer dashboard stats |
| `/owner` | Owner registration, profile, documents, dashboard, analytics, reviews, earnings, settlements, bank account |
| `/vehicles` | Search (PostGIS radius tiers), detail, similar vehicles, pricing config, owner fleet CRUD, photos, documents, availability, activation requests |
| `/drivers` | Owner driver roster, available drivers, assign/unassign to a booking |
| `/trips` | Customer trips: create, list, active, update, cancel |
| `/quotations` | Customer requests, owner inbox/sent, send, respond (accept/reject), pricing suggestions |
| `/bookings` | Create from quotation, customer/owner lists, cancel, start, complete, driver, itinerary |
| `/packages` | Trip packages: public list/detail, owner CRUD, direct booking |
| `/payments` | PayHere intent/confirm, webhook (MD5-verified), bank details, receipt upload, refund |
| `/reviews` | Vehicle reviews, customer reviews, pending reviews, owner summary and response |
| `/disputes` | Raise, list, detail, message |
| `/messages` | Booking conversations, messages, read receipts, unread count |
| `/notifications` | List, unread count, mark read, delete |
| `/routing` | OSRM route calculation |
| `/landing`, `/content` | Public CMS content, config, stats, contact form, route estimate, content pages |
| `/uploads` | Registration document upload |
| `/admin` | All admin sub-modules (requires `ADMIN` plus sub-role/permission guards) |

## Authentication

- On login, the access and refresh JWTs are set as **cookies** (`accessToken`, refresh cookie). The middleware also accepts `Authorization: Bearer <token>`.
- Access tokens default to 1 h and refresh tokens to 30 d (`JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`). `tokenVersion` invalidates all sessions after a password change.
- Mutating requests on protected modules need the `x-csrf-token` header to match the `csrf-token` cookie (get one from `GET /auth/csrf-token`).
- Rate limits (100 / 15 min global, 10 / 15 min on auth routes) apply only when `NODE_ENV=production`.

## Responses

Success responses use `{ success: true, data, ... }` (`utils/response.ts`). Errors go through `middleware/errorHandler.ts` (`ApiError`) and return `{ success: false, error: { code, message } }`.
