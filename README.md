# TraveNest

**Sri Lanka's Premier Vehicle Rental Marketplace**

TraveNest is a web-based vehicle rental marketplace platform designed to connect vehicle owners with customers seeking transportation services across Sri Lanka.

## Project Architecture

This is a **monorepo** managed with `pnpm` workspaces:

```
travenest/
├── apps/
│   ├── web/                 # Next.js 16 frontend (@travenest/web)
│   └── api/                 # Express.js backend API (@travenest/api)
├── packages/
│   ├── database/            # Prisma ORM & database schema (@travenest/database)
│   └── shared-types/        # Shared TypeScript types (@travenest/shared-types)
└── package.json             # Root package.json with workspace commands
```

## Quick Start for New Developers 🚀

Welcome! If you're a new developer joining the project, follow these steps to get the environment running locally.

### 1. Prerequisites

- **Node.js**: v18.0.0 or higher
- **Package Manager**: `pnpm` (Install via `npm install -g pnpm`)
- **Database**: PostgreSQL (Ensure you have a local instance running or a cloud DB connection string)
- **External Accounts**: Google Maps API Key, PayHere account, Twilio, AWS S3 (for full functionality)

### 2. Installation & Setup

Clone the repository and install all dependencies from the root directory:

```bash
git clone https://github.com/MazterGD/TraveNest.git
cd TraveNest

# Install dependencies for all apps and packages
pnpm install
```

### 3. Environment Variables

Set up your local environment variables. From the root directory:
```bash
# For the Express API
cp apps/api/.env.example apps/api/.env

# For the Next.js Web App
cp apps/web/.env.example apps/web/.env.local
```
_Make sure to open these files and update them with your actual local credentials, particularly `DATABASE_URL` for PostgreSQL._

### 4. Database Initialization & Seeding

We use **Prisma** as our ORM. All database commands should be executed from the **root** of the project:

```bash
# 1. Push the database schema to your local PostgreSQL instance to create the tables
pnpm db:push

# 2. Generate the Prisma Client (TypeScript types based on your schema)
pnpm db:generate

# 3. Seed the database with initial/dummy data to help you test
pnpm db:seed
```

### 5. Starting the Development Servers

You can start the frontend and backend simultaneously, or individually. Run these from the **root** directory:

```bash
# Start both the Web Frontend (Next.js) and the API Backend (Express)
pnpm dev

# Alternatively, start them individually:
pnpm dev:web   # Starts only the Next.js frontend on port 3000
pnpm dev:api   # Starts only the Express API on port 5000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠 Database Management: How to Add or Update Tables

If you are tasked with adding a new feature that requires database changes (e.g., adding a new table or modifying an existing one), here is the standard workflow:

### Step 1: Modify the Prisma Schema
Navigate to our central database package:
```
packages/database/prisma/schema.prisma
```
Open this file and define your new `model`, or add/remove columns from an existing model following Prisma syntax.

### Step 2: Generate Updated Typings
Once your schema is updated, you must rebuild the Prisma Client so your TypeScript code recognizes the changes. Run from the root:
```bash
pnpm db:generate
```

### Step 3: Apply Changes to the Database
To apply your definitions to the actual PostgreSQL database:
- **During Local Prototyping**: Run `pnpm db:push` from the root. This forces the local database schema to match your Prisma schema rapidly.
- **For Production/Team Sharing**: Run `pnpm db:migrate` to create a formal SQL migration history file.

### Step 4: Add Seed Data (Optional)
If your new table needs initial test data, navigate to:
```
packages/database/src/seed.ts
```
Add records for your new model, then run `pnpm db:seed` from the root.

### Step 5: View Your Data
To visually inspect your database tables and records via GUI:
```bash
pnpm db:studio
```
This opens Prisma Studio.

---

## 💻 Workspace Command Reference

Here is a cheat sheet for `pnpm` workspace commands run from the root:

| Command | Description |
|---|---|
| `pnpm install` | Installs dependencies across all workspaces |
| `pnpm dev` | Starts all development servers (web & api) |
| `pnpm dev:web` | Starts only the Next.js frontend |
| `pnpm dev:api` | Starts only the Express backend |
| `pnpm build` | Builds all workspaces for production |
| `pnpm typecheck` | Runs TypeScript typechecking without emitting files |
| `pnpm lint` | Runs ESLint and style checks |
| `pnpm clean` | Removes all `node_modules`, `.next`, and `dist` folders |

**Database Shortcuts:**
| Command | Description |
|---|---|
| `pnpm db:generate` | Generates Prisma Client (`prisma generate`) |
| `pnpm db:push` | Pushes schema without migrations (`prisma db push`) |
| `pnpm db:migrate` | Runs dev migrations (`prisma migrate dev`) |
| `pnpm db:seed` | Seeds the database |
| `pnpm db:studio` | Opens Prisma Studio |

---

## Features

### For Customers

- Advanced search with filters (capacity, amenities, price, location)
- Standardized quotation requests with transparent cost breakdowns
- Multi-vendor comparison
- Secure online booking and payment
- Multilingual support (English, Sinhala, Tamil)
- Rating and review system

### For Bus Owners

- Self-registration with document verification
- Fleet management and availability calendars
- Automated quotation generation
- Performance analytics
- Direct customer communication

### For Admins

- Owner verification and approval workflows
- Dispute resolution
- Platform analytics and reporting
- System management

## 🎨 Styling & Design

The project uses:

- **Tailwind CSS** for styling
- **Custom CSS variables** for theming
- **HSL color system** for consistent color management
- **Responsive design** with mobile-first approach

### Brand Colors

- **Primary:** Deep Blue (#00476B) - Main brand color, trust and reliability
- **Secondary:** Muted Blue (#2F6280) - Secondary actions and text
- **Accent:** Light Blue (#6ACAF0) - Interactive elements and highlights
- **Muted:** Soft Cyan (#C9E9F8) - Backgrounds and subtle elements
- **Card:** Very Light Blue (#DAF3FB) - Card backgrounds

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For questions or support, please contact [support@travenest.lk](mailto:support@travenest.lk)

---

**Built with ❤️ for Sri Lanka**
