# Deploying TraveNest

This guide deploys TraveNest on free-forever tiers, following the topology in [`architecture.md § Deployment Topology`](architecture.md#deployment-topology-planned):

| Piece | Service | Free tier (checked October 2026) |
|---|---|---|
| Web app (`apps/web`) | **Vercel Hobby** | Free; non-commercial use only. One concurrent build. |
| API + Socket.IO + jobs (`apps/api`) | **Oracle Cloud Always Free** Ampere A1 VM | 2 OCPU / 12 GB RAM in total per tenancy (cut from 4 / 24 GB in mid-2026). 200 GB block storage. |
| Routing engine | **OSRM** in Docker on the same VM | Open source |
| TLS / reverse proxy | **Caddy** on the VM | Open source; automatic Let's Encrypt certificates |
| Database (PostgreSQL 16 + PostGIS) | **Supabase Free** (or Neon Free) | Supabase: 500 MB database, 2 active projects, paused after 7 days without activity |
| File storage | **Supabase Storage** (same project) | 1 GB storage, 5 GB egress |
| Email | **Brevo Free** | 300 emails/day, shared by all mail you send |
| Card payments | **PayHere** | No monthly fee; per-transaction fees on live payments |
| Sign-in with Google / Facebook | Google Auth Platform, Meta for Developers | Free |
| CI | GitHub Actions | Free for public repositories |

> **Free tiers change.** The figures above were checked in October 2026. Oracle halved its A1 allowance in June–July 2026 without much notice, so check each provider's pricing page before you rely on a limit.

**The one thing that is not free is a domain name** (about USD 10 a year). Use one: auth cookies must be first-party, so the web app and API should be sibling subdomains such as `app.example.lk` and `api.example.lk`. A `*.vercel.app` web app talking to an API on another domain breaks sign-in in browsers that block third-party cookies (Safari, and Chrome with tracking protection).

The steps below use `example.lk` as the domain. Replace it with yours.

---

## 0. Before you start

You need:

- A GitHub account with this repository (or your fork).
- A domain you can add DNS records to.
- Locally: Node.js 24 LTS, pnpm 10 (`corepack enable`), and `openssl` for generating secrets.

Generate the secrets now and keep them in a password manager:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 32   # SETTLEMENT_BANK_ENCRYPTION_KEY
```

> `SETTLEMENT_BANK_ENCRYPTION_KEY` encrypts owner bank details at rest. If you lose or change it, stored bank details cannot be decrypted.

---

## 1. Database and storage: Supabase

1. Sign in at [supabase.com](https://supabase.com) and click **New project**.
   - **Region:** Southeast Asia (Singapore) is the closest to Sri Lanka.
   - Set a strong **database password** and save it.
2. When the project is ready, click **Connect** in the top bar. Under **Connection string**, choose the **Session pooler** string (port `5432`). It works over IPv4, which the Oracle VM uses. The direct connection is IPv6-only on the free plan.
   It looks like this. This is your `DATABASE_URL`:
   ```
   postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```
3. Go to **Storage** and create two buckets:
   - `travenest`: turn **Public bucket** on (vehicle photos, avatars).
   - `travenest-private`: leave it **private** (owner documents, payment receipts; served only as one-hour signed links).
4. Go to **Project Settings → API Keys** and copy:
   - the **Publishable key** (`sb_publishable_…`), which becomes `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`;
   - a **Secret key** (`sb_secret_…`), which becomes `SUPABASE_SERVICE_ROLE_KEY`. **API only; never put it in the web app.**
   - The project URL (`https://<project-ref>.supabase.co`) becomes `NEXT_PUBLIC_SUPABASE_URL`.

PostGIS does not need to be enabled by hand: the first migration runs `CREATE EXTENSION IF NOT EXISTS postgis`. You apply the migrations from the VM in step 3.

> **Pausing:** a free Supabase project pauses after 7 days without database activity. Normal traffic keeps it awake. If a project pauses, restore it from the dashboard. Free projects have no dependable automatic backups, so step 3.8 adds a nightly `pg_dump`.
>
> **Neon instead:** if you prefer Neon (1 GB per project, scales to zero after 5 minutes idle), create a project in the AWS Singapore region and use the connection string from **Connect** as `DATABASE_URL` (the migrations enable PostGIS). You still need Supabase for storage.

---

## 2. Email: Brevo

1. Sign up at [brevo.com](https://www.brevo.com) (Free plan, no card).
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain:** add `example.lk` and create the DNS records it shows (Brevo code, DKIM and DMARC). Wait until the domain shows as authenticated.
3. **Senders → Add a sender:** for example `noreply@example.lk`. This is `EMAIL_FROM`.
4. **SMTP & API → SMTP tab → Generate a new SMTP key.** Copy:
   - **Login** (looks like `xxxx@smtp-brevo.com`), which becomes `SMTP_USER`;
   - the **SMTP key**, which becomes `SMTP_PASS`.
   - Server `smtp-relay.brevo.com`, port `587`.

The free plan's 300 emails a day covers OTP codes, password resets and booking emails for a pilot launch.

---

## 3. API server: Oracle Cloud Always Free VM

### 3.1 Create the VM

1. Sign up at [cloud.oracle.com](https://www.oracle.com/cloud/free/). Your **home region** is fixed at signup and A1 capacity varies by region; Singapore or Mumbai are the closest to Sri Lanka.
2. **Compute → Instances → Create instance**:
   - **Image:** Canonical Ubuntu 24.04.
   - **Shape:** Ampere → `VM.Standard.A1.Flex`, **2 OCPU, 12 GB memory** (the whole free allowance).
   - **Networking:** create a new VCN with a public subnet and **Assign a public IPv4 address**.
   - **SSH keys:** upload your public key.
   - **Boot volume:** 50 GB is plenty (the free allowance is 200 GB in total).
   - If you see "Out of capacity", retry later or in another availability domain.
3. Note the instance's **public IP**.

> **Idle reclamation:** Oracle can reclaim Always Free instances whose CPU, network and memory all stay under 20% for a week. A quiet pilot can hit that. Upgrading the account to **Pay As You Go** removes idle reclamation; usage within the Always Free limits is still not charged. Set a budget alert if you upgrade.

### 3.2 Open ports 80 and 443

1. **Networking → Virtual cloud networks →** your VCN **→ Security → Security lists → Default security list → Add ingress rules:** source `0.0.0.0/0`, TCP, destination ports `80,443`.
2. Oracle's Ubuntu images also block these in `iptables`. On the VM:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

### 3.3 DNS

At your domain registrar add:

| Type | Name | Value |
|---|---|---|
| A | `api` | the VM's public IP |

(The web app's record is added in step 4.)

### 3.4 Install the runtime

```bash
ssh ubuntu@<public-ip>

sudo timedatectl set-timezone Asia/Colombo     # trip-day checks use server-local dates

# Node.js 24 LTS and pnpm
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo corepack enable

# PM2 keeps the API running and restarts it on reboot
sudo npm install -g pm2

# Docker for OSRM
sudo apt-get install -y docker.io
sudo usermod -aG docker ubuntu && newgrp docker

# Caddy (official apt repository)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

### 3.5 Start OSRM (Sri Lanka road graph)

The image is published for ARM64, so it runs on Ampere. Preparing the graph takes a few minutes and uses about 2 GB of memory.

```bash
mkdir -p ~/osrm && cd ~/osrm
curl -LO https://download.geofabrik.de/asia/sri-lanka-latest.osm.pbf
IMG=ghcr.io/project-osrm/osrm-backend:latest
docker run --rm -t -v "$PWD:/data" $IMG osrm-extract -p /opt/car.lua /data/sri-lanka-latest.osm.pbf
docker run --rm -t -v "$PWD:/data" $IMG osrm-partition /data/sri-lanka-latest.osrm
docker run --rm -t -v "$PWD:/data" $IMG osrm-customize /data/sri-lanka-latest.osrm
docker run -d --name osrm --restart unless-stopped -p 127.0.0.1:5001:5000 -v "$PWD:/data" \
  $IMG osrm-routed --algorithm mld /data/sri-lanka-latest.osrm
curl "http://127.0.0.1:5001/route/v1/driving/79.8612,6.9271;80.6337,7.2906?overview=false"   # Colombo → Kandy
```

OSRM listens on `127.0.0.1` only; the API is its only client.

### 3.6 Configure and build the API

```bash
cd ~ && git clone https://github.com/MazterGD/TravelNest.git TraveNest && cd TraveNest
pnpm install --frozen-lockfile
cp apps/api/.env.example .env
nano .env
```

Fill in `.env` (the template explains every variable). The production values that matter:

```bash
NODE_ENV=production
PORT=5000
TZ=Asia/Colombo
APP_URL=https://app.example.lk
API_BASE_URL=https://api.example.lk/api/v1
CORS_ORIGIN=https://app.example.lk
TRUST_PROXY=1
COOKIE_DOMAIN=.example.lk

DATABASE_URL=<Supabase session pooler string>
JWT_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
SETTLEMENT_BANK_ENCRYPTION_KEY=<secret>

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=<Brevo login>
SMTP_PASS=<Brevo SMTP key>
EMAIL_FROM=noreply@example.lk

NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<publishable key>
SUPABASE_BUCKET=travenest
SUPABASE_PRIVATE_BUCKET=travenest-private
SUPABASE_SERVICE_ROLE_KEY=<secret key>

OSRM_BASE_URL=http://127.0.0.1:5001

# Filled in during steps 5 and 6
PAYHERE_MODE=sandbox
PAYHERE_MERCHANT_ID=
PAYHERE_MERCHANT_SECRET=
PAYHERE_APP_ID=
PAYHERE_APP_SECRET=
PAYHERE_NOTIFY_URL=https://api.example.lk/api/v1/payments/webhook
PAYHERE_RETURN_URL=https://app.example.lk/en/dashboard/bookings
PAYHERE_CANCEL_URL=https://app.example.lk/en/dashboard/bookings
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://api.example.lk/api/v1/auth/oauth/google/callback
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FACEBOOK_REDIRECT_URI=https://api.example.lk/api/v1/auth/oauth/facebook/callback
```

The API refuses to start in production without the JWT secrets, `CORS_ORIGIN`, `APP_URL`, the PayHere merchant credentials and the Supabase secret key. Use PayHere **sandbox** credentials until your live account is approved.

Apply the database schema, then build and start:

```bash
chmod 600 .env
pnpm db:generate
pnpm db:migrate:deploy        # never `db push`: PostGIS objects live in raw-SQL migrations
pnpm build:api
pm2 start "pnpm start:api" --name travenest-api
pm2 save && pm2 startup       # run the command it prints, so the API survives reboots
curl http://127.0.0.1:5000/health
```

> **Do not run `pnpm db:seed` in production.** It wipes data and creates accounts with published demo passwords; it refuses to run when `NODE_ENV=production`. Step 7 shows how to create the first admin.

Run the API as a **single instance** (no PM2 cluster mode): Socket.IO and the background jobs run in-process.

### 3.7 HTTPS with Caddy

```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
api.example.lk {
	encode gzip
	reverse_proxy 127.0.0.1:5000
}
EOF
sudo systemctl reload caddy
curl https://api.example.lk/health
```

Caddy obtains and renews the Let's Encrypt certificate and proxies WebSocket traffic for Socket.IO with no extra configuration.

### 3.8 Nightly database backup (recommended)

```bash
sudo apt-get install -y postgresql-client
mkdir -p ~/backups
( crontab -l 2>/dev/null; echo '30 2 * * * pg_dump "$(grep ^DATABASE_URL= ~/TraveNest/.env | cut -d= -f2-)" -Fc -f ~/backups/travenest-$(date +\%a).dump' ) | crontab -
```

This keeps a rolling week of dumps on the VM. Copy them off the server from time to time.

### 3.9 Updating the API later

```bash
cd ~/TraveNest && git pull
pnpm install --frozen-lockfile
pnpm db:generate && pnpm db:migrate:deploy
pnpm build:api && pm2 restart travenest-api
```

---

## 4. Web app: Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub and choose the **Hobby** plan.
2. **Add New… → Project**, then import the repository.
3. On the configure screen:
   - **Root Directory:** `apps/web`. Vercel detects Next.js and pnpm from the lockfile; keep the default build and install commands. Keep "Include files outside the root directory" enabled; the web app imports the shared types package.
   - **Environment Variables** (Production):
     | Name | Value |
     |---|---|
     | `NEXT_PUBLIC_API_URL` | `https://api.example.lk/api/v1` |
     | `NEXT_PUBLIC_APP_URL` | `https://app.example.lk` |
     | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
     | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | publishable key |
4. Click **Deploy**.
5. **Project → Settings → Domains → Add** `app.example.lk`. Vercel shows the DNS record to create at your registrar (a CNAME for a subdomain). The certificate is issued automatically.

Every push to the production branch redeploys the web app. `NEXT_PUBLIC_*` values are built into the bundle, so redeploy after changing them.

> Vercel Hobby is for non-commercial use. A commercial launch needs the Pro plan, or hosting the web app on the same VM (`pnpm build:web && pm2 start "pnpm start:web"` behind Caddy).

---

## 5. Card payments: PayHere

1. **Sandbox first:** register at [sandbox.payhere.lk](https://sandbox.payhere.lk).
   - **Settings → Domains & Credentials → Add Domain/App:** add `app.example.lk`. Copy the **Merchant ID** and the domain's **Merchant Secret**, which become `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET`.
   - **Settings → API Keys → Create API Key** (allow the refund permission, add your domain). Copy the **App ID** and **App Secret**, which become `PAYHERE_APP_ID` and `PAYHERE_APP_SECRET` (used for refunds).
2. Put these in the VM's `.env` with `PAYHERE_MODE=sandbox`, then `pm2 restart travenest-api`.
3. Make a test booking and pay with a [PayHere sandbox test card](https://support.payhere.lk/sandbox-and-testing). PayHere calls `PAYHERE_NOTIFY_URL` (`/api/v1/payments/webhook`), which must be the public HTTPS API URL. The API verifies the MD5 signature before changing anything.
4. **Going live:** apply for a live account at [payhere.lk](https://www.payhere.lk). You will need business registration documents, and approval can take a few days. Repeat step 1 on the live portal (domain approval can take up to 24 hours), set `PAYHERE_MODE=live` with the live credentials, and restart.

---

## 6. Social sign-in (optional)

Email and password plus email OTP work without this step.

### Google

1. Open the [Google Cloud console](https://console.cloud.google.com), create a project, then go to **Google Auth Platform**.
2. **Branding:** app name, support email, app home page `https://app.example.lk`, privacy policy link (`https://app.example.lk/en/privacy`) and authorised domain `example.lk`.
3. **Audience:** user type **External**. Click **Publish app** when you are ready for the public (until then only listed test users can sign in).
4. **Clients → Create client → Web application:**
   - Authorised JavaScript origins: `https://app.example.lk`
   - Authorised redirect URIs: `https://api.example.lk/api/v1/auth/oauth/google/callback`
5. Copy the client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### Facebook

1. At [developers.facebook.com](https://developers.facebook.com) choose **My Apps → Create app** and pick the use case **Authenticate and request data from users with Facebook Login**.
2. In the use case's **Customize → Settings**, add the valid OAuth redirect URI `https://api.example.lk/api/v1/auth/oauth/facebook/callback`. Make sure the `email` permission is enabled.
3. **App settings → Basic:** app domain `example.lk`, privacy policy URL, and a user data deletion URL or instructions page. Copy the **App ID** and **App secret** into `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`.
4. **Publish** the app (switch it from Development to Live). Until then only app roles can sign in.

Restart the API after adding the credentials: `pm2 restart travenest-api`.

---

## 7. One-off steps after the first deploy

```bash
cd ~/TraveNest
# Move documents and receipts uploaded before the private bucket existed (dry run first)
pnpm --filter @travenest/api storage:backfill-private
pnpm --filter @travenest/api storage:backfill-private --apply
```

**Create the first admin.** Register a normal account on the web app with the email you want to use, then promote it in the Supabase **SQL Editor**:

```sql
UPDATE users
SET role = 'ADMIN', "adminRole" = 'SUPER_ADMIN', "isVerified" = true, "emailVerified" = true
WHERE email = 'you@example.lk';
```

Sign out and back in to pick up the new role. Create further admins from **Admin → Users**, where you pick their admin role and permissions.

Then set the platform settings (base rates per vehicle type, commission, booking window, refund policy) and the bank details customers see for transfers (`BANK_*` in `.env`).

## 8. Final checks

- `https://api.example.lk/health` returns `{"status":"healthy",…}`.
- `https://app.example.lk/en` loads, and the browser console shows no CORS errors.
- Register a customer account: the OTP email arrives from your Brevo sender.
- Sign in, reload the page: you stay signed in (refresh cookie works across `app.` and `api.`).
- Request a quotation: the route map and distance appear (OSRM works).
- Upload an owner document: it lands in the **private** bucket and opens through a signed link.
- Pay a test booking in sandbox: the booking becomes **Confirmed**.

## 9. CI and CD

GitHub Actions runs on every push: lint, type check, API tests against a PostGIS service (with a migration drift check and a coverage floor), web tests with coverage, a Playwright smoke run over production builds, the build, a production-dependency audit and CodeQL. No secrets are needed.

Deployment is manual (steps 3.9 and Vercel's Git integration). The deploy jobs in `.github/workflows/cd.yml` are placeholders: an automated deploy step is on the roadmap.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| API exits on start with `Missing required environment variable` | A production-required variable is empty in `.env` |
| Signed in, but signed out again after a reload | `COOKIE_DOMAIN` not set to `.example.lk`, or web and API on unrelated domains |
| CORS error in the browser | `CORS_ORIGIN` does not exactly match the web origin (scheme, no trailing slash) |
| Caddy cannot get a certificate | DNS `A` record not pointing at the VM yet, or ports 80/443 closed (security list or `iptables`) |
| Quotation distance is empty | OSRM container not running: `docker ps`, `docker logs osrm` |
| `P1001` cannot reach database | Using the IPv6-only direct connection string; use the session pooler string, or the Supabase project is paused |
| PayHere payment stays pending | `PAYHERE_NOTIFY_URL` is not the public HTTPS API URL, or the merchant secret is for a different domain |
