# TraveNest

**Sri Lanka's multi-vendor bus charter marketplace.**

[![CI](https://github.com/MazterGD/TravelNest/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/MazterGD/TravelNest/actions/workflows/ci.yml)
[![CodeQL](https://github.com/MazterGD/TravelNest/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/MazterGD/TravelNest/actions/workflows/codeql.yml)
![API coverage](https://img.shields.io/badge/API%20coverage-93%25%20lines-brightgreen)
![Web coverage](https://img.shields.io/badge/web%20coverage-99%25%20lines-brightgreen)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node.js 24](https://img.shields.io/badge/node-24%20LTS-339933)

TraveNest connects independent bus owners with groups who need a bus: schools, religious organisations, companies and event planners. Customers plan a trip, collect itemised quotations from verified owners, compare them, then book and pay online. Owners manage their fleet, drivers, quotations and earnings. Admins run verification, disputes, payouts and site content.

It is a mobile-first Progressive Web App available in English, Sinhala and Tamil.

> Documentation: [`context.md`](context.md) (scope and features), [`architecture.md`](architecture.md) (technical design), [`TravelNest-Design-System.md`](TravelNest-Design-System.md) (UI rules), [`DEPLOYMENT.md`](DEPLOYMENT.md) (production deployment), [`.github/CICD.md`](.github/CICD.md) (pipelines).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (React 19), Tailwind CSS 4, `motion`, `lucide-react`, `next-intl`, `zustand`, Leaflet + OpenStreetMap, PWA via `@ducanh2912/next-pwa` |
| Backend | Express 4 modular monolith, Prisma 6, Zod, Socket.IO, JWT cookies, Helmet, CSRF, `express-rate-limit` |
| Database | PostgreSQL 16 + **PostGIS** |
| Routing | OSRM (self-hosted Docker) |
| Payments | PayHere (card), bank transfer, cash |
| Email | Brevo SMTP via `nodemailer` |
| Storage | Supabase Storage |
| Testing | Vitest + Supertest (API, against a real PostGIS database), Vitest + Testing Library (web), Playwright (end-to-end smoke) |

Every external service has a free-forever tier. See `architecture.md § Infrastructure & DevOps`.

## Repository Layout

```
travenest/
├── apps/
│   ├── web/              # Next.js 16 frontend          (@travenest/web)
│   └── api/              # Express API + Socket.IO       (@travenest/api)
│       └── scripts/      # PayHere webhook simulator
├── packages/
│   ├── database/         # Prisma schema, migrations, seed, backfills (@travenest/database)
│   └── shared-types/     # Shared TypeScript types       (@travenest/shared-types)
└── .github/workflows/    # CI (ci.yml, pr.yml, codeql.yml) and CD (cd.yml)
```

---

## Getting Started

### 1. Prerequisites

- **Node.js** 24 LTS (22 also works) and **pnpm** 10 (`corepack enable`)
- **PostgreSQL 16 with the PostGIS extension** (local install, Docker `postgis/postgis:16-3.4`, or a free Supabase/Neon database)
- **Docker**, to run OSRM for route and distance calculation
- Optional, for full functionality: a Supabase project (storage), a Brevo account (email), PayHere sandbox merchant credentials, and Google/Facebook OAuth apps

### 2. Install

```bash
git clone https://github.com/MazterGD/TravelNest.git TraveNest
cd TraveNest
pnpm install
```

### 3. Environment variables

Start from the templates `apps/api/.env.example` and `apps/web/.env.example`; they list every variable with comments.

- **`/.env`** (repository root): the API reads this file as well as `apps/api/.env`, and the database scripts use it. Most variables go here.
- **`apps/web/.env.local`**: public variables for the frontend.

Minimum for local development:

```bash
# /.env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/travenest"
JWT_SECRET="change-me"
JWT_REFRESH_SECRET="change-me-too"
APP_URL="http://localhost:3000"
CORS_ORIGIN="http://localhost:3000"
OSRM_BASE_URL="http://127.0.0.1:5001"
```

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL="http://localhost:5000/api/v1"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
# Optional: lets the How It Works page load its images from the Supabase bucket
NEXT_PUBLIC_SUPABASE_URL="..."
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="..."
```

<details>
<summary>All supported variables</summary>

| Group | Variables |
|---|---|
| Server | `PORT` (5000), `API_VERSION` (v1), `APP_URL`, `API_BASE_URL`, `CORS_ORIGIN`, `NODE_ENV`, `TZ` (`Asia/Colombo`), `TRUST_PROXY` (1 behind a reverse proxy), `COOKIE_DOMAIN` (sibling subdomains) |
| Auth | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `OAUTH_STATE_SECRET` |
| OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_REDIRECT_URI` |
| Email (Brevo) | `SMTP_HOST` (`smtp-relay.brevo.com`), `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` |
| PayHere | `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_APP_ID`, `PAYHERE_APP_SECRET`, `PAYHERE_MODE` (`sandbox`/`live`), `PAYHERE_NOTIFY_URL`, `PAYHERE_RETURN_URL`, `PAYHERE_CANCEL_URL` |
| Bank transfer | `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_BRANCH`, `BANK_REFERENCE_HINT` |
| Storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `SUPABASE_BUCKET` (`travenest`, public), `SUPABASE_PRIVATE_BUCKET` (`travenest-private`, documents and receipts), `SUPABASE_SERVICE_ROLE_KEY` (API only), `MAX_FILE_SIZE` |
| Encryption | `SETTLEMENT_BANK_ENCRYPTION_KEY` (falls back to `BANK_DATA_ENCRYPTION_KEY`, then `JWT_SECRET`) |
| Routing | `OSRM_BASE_URL`, `OSRM_TIMEOUT_MS` |
| Rate limits (production only) | `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `AUTH_RATE_LIMIT_WINDOW_MS`, `AUTH_RATE_LIMIT_MAX_REQUESTS` |
| Seed | `SEED_DEMO_DATE` |

</details>

Without SMTP settings, emails are skipped; in development OTP codes and reset links are printed to the API console instead. Without Supabase settings, file uploads return an error. Without `SUPABASE_SERVICE_ROLE_KEY`, development stores private documents in the public bucket (with a warning); production refuses to start.

### 4. Run OSRM (routing engine)

Run this once to build the Sri Lanka road graph, then start the server on port 5001:

```bash
mkdir osrm-data && cd osrm-data
curl -O https://download.geofabrik.de/asia/sri-lanka-latest.osm.pbf
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/sri-lanka-latest.osm.pbf
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-partition /data/sri-lanka-latest.osrm
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-customize /data/sri-lanka-latest.osrm
docker run -d --name osrm -p 5001:5000 -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/sri-lanka-latest.osrm
```

### 5. Database

Run these from the repository root:

```bash
pnpm db:migrate:deploy   # apply all migrations (enables PostGIS, triggers, spatial indexes)
pnpm db:generate         # generate the Prisma client
pnpm db:seed             # demo data; optional demo anchor date: pnpm db:seed 2026-06-03
```

> Use migrations, not `pnpm db:push`. The PostGIS extension, the `vehicles.geom` trigger and the GIST indexes live in raw-SQL migrations, and `db push` does not create them.

Seeded logins:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@travenest.lk` | `admin@123` |
| Owner (verified) | `nuwan.perera@gmail.com` | `owner@123` |
| Owner (pending approval) | `kasun.fernando@outlook.com` | `owner@123` |
| Customer | `dilshan.jayawardena@gmail.com` | `customer@123` |

### 6. Start the dev servers

```bash
pnpm dev        # web + api
pnpm dev:web    # Next.js on http://localhost:3000
pnpm dev:api    # Express on http://localhost:5000 (REST /api/v1, WebSocket /socket.io, GET /health)
```

### 7. Testing card payments locally

PayHere cannot deliver webhooks to `localhost`. Either expose the API with ngrok and set `PAYHERE_NOTIFY_URL`, or complete a payment with the simulator, which sends a correctly signed webhook:

```bash
pnpm --filter @travenest/api payhere:simulate <bookingId>
```

---

## Database Changes

1. Edit `packages/database/prisma/schema.prisma`.
2. Create a migration: `pnpm db:migrate` (`prisma migrate dev`). Commit the generated folder under `prisma/migrations/`.
3. Regenerate the client: `pnpm db:generate`. Stop the dev servers first on Windows, because the running API locks the Prisma engine DLL.
4. If the change needs seed data, update `packages/database/src/seed.ts`.
5. Inspect the data with `pnpm db:studio`.

Maintenance scripts (all idempotent):

```bash
pnpm db:backfill:content
pnpm --filter @travenest/database backfill:vehicle-coordinates
pnpm --filter @travenest/database backfill:osrm-routes
pnpm --filter @travenest/database backfill:settlement-bank-encryption
```

---

## Command Reference

| Command | Description |
|---|---|
| `pnpm dev` / `dev:web` / `dev:api` | Start development servers |
| `pnpm build` / `build:web` / `build:api` | Production builds |
| `pnpm start` / `start:web` / `start:api` | Run production builds |
| `pnpm lint` | ESLint across workspaces |
| `pnpm typecheck` | `tsc --noEmit` across workspaces |
| `pnpm test` / `test:watch` / `test:coverage` | API test suite (Vitest + Supertest) |
| `pnpm --filter @travenest/web test` / `test:coverage` | Web test suite |
| `pnpm --filter @travenest/web test:e2e` | Playwright smoke suite (needs running API and web) |
| `pnpm ci` | lint + typecheck + test + build |
| `pnpm clean` | Remove `node_modules`, `.next`, `dist` |
| `pnpm db:generate` / `db:migrate` / `db:migrate:deploy` / `db:push` / `db:seed` / `db:studio` | Prisma commands |

> API tests run against the database in `DATABASE_URL`. Point it at a throwaway database, not your development data. Set test-only environment variables in `apps/api/tests/setup.ts`.

---

## Testing

| Suite | Where | What it covers | Coverage (Oct 2026) |
|---|---|---|---|
| API unit + integration | `apps/api/tests` | 1,050 tests over every module, run against a migrated PostgreSQL + PostGIS database | 93% statements, 79% branches, 97% functions, 94% lines |
| Web unit + component | `apps/web/src/__tests__` | Pages, components, hooks, stores and the API client in jsdom | 99% statements, 96% branches, 99% functions, 99% lines |
| End-to-end smoke | `apps/web/e2e` | Production builds on a mobile viewport: public pages in all three languages, search, and sign-in for each role | 10 scenarios |

CI enforces coverage floors (API 92/78/95/92, web 98/94/98/98 for statements/branches/functions/lines), so coverage cannot quietly drop. Reports are uploaded as workflow artifacts on every run.

---

## Features

### Customers
- Plan a trip once, then request quotations from several buses under it
- Search with nearby-city matching (10 / 20 / 30 km, then district), maps and route preview
- Compare itemised quotations side by side; accepting one reserves the bus
- Pay by PayHere card, bank transfer (receipt upload) or cash; time-based refunds
- Fixed-price trip packages that can be booked directly
- Real-time chat with the owner, notifications, disputes, and reviews with six rating dimensions
- Printable invoices and booking documents
- English, Sinhala and Tamil

### Bus Owners
- Self-registration with document verification and a pending-approval tracker
- Fleet management (photos, documents, availability calendar) on platform-set base rates
- Driver roster with per-booking assignment
- Quotation form pre-filled from route distance and platform rates
- Trip packages, analytics, earnings and settlement history, payout bank account

### Admins
- Owner, vehicle and document verification
- User, booking, dispute and review management
- Commission rules and owner settlements
- Reports exported as CSV, PDF or Excel; audit log
- CMS for pages, FAQs, testimonials, amenities and landing content
- Platform settings: pricing, booking window, refund policy, maintenance mode; broadcast notifications

---

## Design

The UI follows [`TravelNest-Design-System.md`](TravelNest-Design-System.md): the Inter typeface, `#20B0E9` (`--color-action-primary`) for interactive elements only, a neutral slate palette for everything else, an 8px spacing scale, three radius levels (20 / 12 / 8 px), `motion/react` spring animations and WCAG AA accessibility. Dark mode is deferred to after v1.0.

---

## Deployment

TraveNest runs entirely on free-forever tiers: the web app on **Vercel Hobby**, the API and OSRM on an **Oracle Cloud Always Free** Ampere VM behind Caddy, PostgreSQL + PostGIS and file storage on **Supabase**, and email through **Brevo**. The only cost is a domain name. The API must stay a single long-running instance because it hosts Socket.IO and in-process background jobs.

Step-by-step instructions: **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## Contributing

Contributions are welcome.

1. Fork the repository and create a branch from `staging`.
2. Read [`context.md`](context.md), [`architecture.md`](architecture.md) and [`TravelNest-Design-System.md`](TravelNest-Design-System.md): changes must fit the documented scope, architecture and design tokens.
3. Keep changes focused, add or update tests, and make sure `pnpm lint`, `pnpm typecheck` and both test suites pass. CI also checks schema drift, coverage floors and production dependency advisories.
4. Schema changes need a migration in `packages/database/prisma/migrations` (use `pnpm db:migrate`, never `db push`).
5. Open a pull request describing what changed and why.

## Security

Please do not open public issues for vulnerabilities. Report them privately through GitHub's **Security → Report a vulnerability** on this repository, or email [support@travenest.lk](mailto:support@travenest.lk). Known, accepted gaps are listed in `architecture.md § Known Gaps`.

## License

MIT. See [LICENSE](LICENSE).

## Contact

[support@travenest.lk](mailto:support@travenest.lk)
