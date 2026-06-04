# BITS — Attendance Management System

A full-stack attendance management platform with biometric device integration, role-based access control, and automated attendance tracking. Built with Next.js and Express.js, containerized with Docker.

## Tech Stack

| Layer          | Technology                                                     |
| -------------- | -------------------------------------------------------------- |
| **Frontend**   | Next.js 16, React 19, TypeScript, Tailwind CSS 4    |
| **Backend**    | Express.js 5, TypeScript, Prisma ORM, Zod validation          |
| **Database**   | PostgreSQL 15                                                  |
| **Auth**       | JWT (access + refresh tokens), bcrypt password hashing         |
| **Biometrics** | ZKTeco device integration via zklib-js / node-zklib            |
| **Email**      | Nodemailer (SMTP — Gmail App Passwords)                        |
| **API Docs**   | Swagger (swagger-jsdoc + swagger-ui-express)                   |
| **Exports**    | ExcelJS / xlsx-js-style                                        |
| **DevOps**     | Docker & Docker Compose (dev + production configs)             |

## Features

### Core Modules

- **Attendance Tracking** — Automated check-in/check-out via biometric devices, anomaly detection, grace periods, late/undertime/overtime calculation
- **Employee Management** — Full employee lifecycle (ACTIVE → STAGED → INACTIVE → TERMINATED), profile pictures, contact info, employee numbers
- **Shift Management** — Configurable shifts with codes, break minutes, night-shift support, work days, half days, per-employee shift assignments
- **Overtime Requests** — Employee-submitted or manager-assigned overtime with approval workflow (PENDING → APPROVED / REJECTED)
- **Attendance Adjustments** — Request check-in/check-out corrections with approval workflow and audit trail
- **Holiday Management** — Regular and special holidays, branch-specific holiday assignments
- **Organization Structure** — Companies, branches, departments with many-to-many relationships
- **Reports & Exports** — Attendance reports with Excel export

### Biometric Device Integration

- ZKTeco device management (connect, sync, health checks)
- Fingerprint enrollment per device per employee
- RFID card enrollment
- Device sync tasks with retry logic
- Biometric exclusion rules per device

### Role-Based Access Control

| Role        | Portal                      | Capabilities                                                              |
| ----------- | --------------------------- | ------------------------------------------------------------------------- |
| **ADMIN**   | `/admin/dashboard`          | Full system access — employees, devices, shifts, holidays, reports, logs  |
| **HR**      | `/hr/dashboard`             | Employee management, attendance, shifts, holidays, overtime, reports       |
| **MANAGER** | `/manager/dashboard`        | Department-scoped employee & attendance management, overtime approvals     |
| **USER**    | `/employee/employee`        | Personal attendance, profile, overtime requests                           |

## Project Structure

```
bits/
├── frontend/                    # Next.js 16 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (admin)/         # Admin portal routes
│   │   │   ├── (auth)/          # Login page
│   │   │   ├── (employee)/      # Employee self-service portal
│   │   │   ├── hr/              # HR portal routes
│   │   │   ├── manager/         # Manager portal routes
│   │   │   └── api/             # Next.js route handlers
│   │   ├── components/          # Shared UI components (Radix UI + shadcn)
│   │   ├── context/             # React context providers
│   │   ├── features/            # Feature modules
│   │   │   ├── adjustments/     ├── attendance/
│   │   │   ├── auth/            ├── biometrics/
│   │   │   ├── dashboard/       ├── devices/
│   │   │   ├── employee-portal/ ├── employees/
│   │   │   ├── holidays/        ├── hr-portal/
│   │   │   ├── manager-portal/  ├── organization/
│   │   │   ├── overtime/        ├── reports/
│   │   │   ├── settings/        ├── shifts/
│   │   │   ├── system/          ├── system-logs/
│   │   │   └── user-accounts/
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utility libraries
│   │   └── types/               # TypeScript type definitions
│   ├── Dockerfile
│   └── next.config.ts           # API proxy rewrites to backend
│
├── backend/                     # Express.js 5 API server
│   ├── src/
│   │   ├── app.ts               # Express app setup
│   │   ├── index.ts             # Server entry point
│   │   ├── modules/             # API route modules
│   │   │   ├── attendance/      ├── auth/
│   │   │   ├── devices/         ├── employees/
│   │   │   ├── holidays/        ├── logs/
│   │   │   ├── me/              ├── organization/
│   │   │   ├── profile-picture/ ├── reports/
│   │   │   ├── shifts/          ├── system/
│   │   │   └── users/
│   │   ├── shared/
│   │   │   ├── config/          # App configuration
│   │   │   ├── events/          # Event system
│   │   │   ├── lib/             # Shared libraries
│   │   │   ├── middleware/      # Auth, validation, rate-limiting
│   │   │   ├── services/        # Business logic services
│   │   │   ├── types/           # Shared types
│   │   │   └── utils/           # Utility functions
│   │   └── scripts/             # CLI scripts (sync, export, debug)
│   ├── prisma/
│   │   ├── schema.prisma        # Database schema (18 models)
│   │   ├── seed.ts              # Database seeder
│   │   └── migrations/          # Migration history
│   ├── uploads/                 # Employee avatars
│   └── Dockerfile
│
├── docker-compose.yml           # Development (bind mounts, hot reload)
├── docker-compose.prod.yml      # Production simulation (baked images)
├── .env.example                 # Environment variable template
└── .gitignore
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Docker](https://www.docker.com/) & Docker Compose
- PostgreSQL 15 (if running locally without Docker)

### Docker (Recommended)

1. **Copy the environment template:**

   ```bash
   # Windows Command Prompt (cmd.exe):
   copy .env.example .env

   # PowerShell / Linux / macOS:
   cp .env.example .env
   ```

2. **Configure environment variables for Docker:**

   Open the newly created `.env` file at the root of the project and update the `FRONTEND_URL` to match the mapped Docker host port (`3013`):
   ```env
   FRONTEND_URL=http://localhost:3013
   ```

3. **Choose your running mode:**

   * **Option A: Development Mode (Hot-Reloading)**
     Best for active coding. Uses bind mounts so code changes are reflected in real time:
     ```bash
     docker-compose up --build
     ```

   * **Option B: Production / Deployment Mode**
     Best for staging, deployment, and testing. Code is baked into the container images (no bind mounts):
     ```bash
     docker compose -f docker-compose.prod.yml up --build
     ```

4. **Access the application:**

   Once the containers are running (in either mode), access the services at:

   | Service  | URL                    |
   | -------- | ---------------------- |
   | Frontend | http://localhost:3013   |
   | Backend  | http://localhost:4013   |
   | Postgres | `localhost:5013`       |

### Local Development (No Docker)

Because the configuration `.env` file resides at the project root, running Prisma CLI commands directly inside the `backend` folder will fail with `Environment variable not found: DATABASE_URL` errors. 

Follow these steps to set up and run the services locally:

**Backend:**

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment:**
   Ensure you have a local PostgreSQL instance running. Create and configure your `.env` file at the **root** directory of the project (`bits/.env`) with your database credentials:
   ```env
   DATABASE_URL=postgresql://postgres:root@127.0.0.1:5432/db_bits
   ```

3. **Run database migrations:**
   Since Prisma needs to read `DATABASE_URL` from `.env`, you can either run migrations from the root directory or copy the `.env` file into the backend folder:

   * **Option A: Run from the project root (Recommended)**
     Keep a single `.env` at the root and point Prisma to the backend schema:
     ```bash
     # Run from the project root:
     npx --prefix backend prisma migrate dev --schema=backend/prisma/schema.prisma
     ```

   * **Option B: Copy `.env` to the backend directory**
     ```bash
     # From the backend/ directory:
     copy ..\.env .env     # Windows CMD
     # or cp ../.env .env  # macOS/Linux
     
     npx prisma migrate dev
     ```

4. **Seed database & start the backend:**
   Once migrations are applied, the backend server and seeder will automatically resolve the root `.env` file:
   ```bash
   # From the backend/ directory:
   npm run seed          # Seed default admin/HR accounts & configuration
   npm run dev:watch     # Start the Express API server with hot-reload (nodemon)
   ```

**Frontend:**

```bash
cd frontend
npm install
npm run dev              # Next.js dev server on port 3000 (automatically resolves root .env)
```


## Build Notes & Troubleshooting

- **If `npm install` fails with `No matching version found for next@...`**: Update `frontend/package.json` to a valid Next.js version.
- **The frontend Dockerfile expects Next.js standalone build output**: Ensure `next.config.ts` contains `output: "standalone"` for production builds.
- **If the Next.js build detects the wrong workspace root**: Run build commands from inside the `frontend/` folder or remove extra lockfiles.
- **The backend uses `patch-package`**: Patches in `backend/patches/` are applied automatically via `postinstall`.
- **Timezone settings**: Timezone is set to `Asia/Manila` in Docker containers.
- **Database authentication failures / `role "..." does not exist`**:
  * **Cause:** PostgreSQL only runs the initialization script (which sets up users and databases) on a **fresh, empty volume**. If you run the stack once and later change `DB_USER` in `.env`, Postgres will skip initialization and keep the old user (e.g. `root`), but the backend will try to connect with the new one.
  * **Fix:** Either make sure `DB_USER` in `.env` matches the user the database was first created with, or delete the old docker volume and start fresh: `docker volume rm project_postgres_data`.
- **API CORS errors (Blocked requests / Blank page on login)**:
  * **Cause:** The backend CORS allowed origin must match the browser's address bar exactly.
  * **Fix:** If accessing the app via Docker, set `FRONTEND_URL=http://localhost:3013` in `.env`. If running locally without Docker, set `FRONTEND_URL=http://localhost:3000`.
- **Frontend failed to proxy / `ECONNREFUSED` in Docker**:
  * **Cause:** Next.js bakes path rewrites into the static routes manifest at build-time.
  * **Fix:** The frontend Dockerfile has been configured to bake in the correct internal hostname (`ENV BACKEND_URL=http://backend:3001`). If you ever modify your Docker Compose services to rename the backend service, update the build-time env in the `frontend/Dockerfile` accordingly.
