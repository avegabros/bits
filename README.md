# BITS — Attendance Management System

A full-stack attendance management platform with biometric device integration, role-based access control, and automated attendance tracking. Built with Next.js and Express.js, containerized with Docker.

## Tech Stack

| Layer          | Technology                                                     |
| -------------- | -------------------------------------------------------------- |
| **Frontend**   | Next.js 16, React 19, TypeScript, Tailwind CSS 4               |
| **Backend**    | Express.js 5, TypeScript, Prisma ORM, Zod validation           |
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
├── agent/                       # Local Branch Agent (Biometric Gateway)
│   ├── src/
│   │   ├── index.ts             # Agent entry point & WebSocket connection
│   │   ├── zk-driver.ts         # Local ZKTeco protocol wrapper (TCP)
│   │   ├── device-queue.ts      # Command queue preventing device concurrency locks
│   │   └── device-command-handler.ts # Command routing execution
│   └── Dockerfile
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
├── .env.local.example           # Env template for local (non-Docker) development
├── .env.docker.example          # Env template for Docker Compose (secrets + overrides only)
└── .gitignore
```

## Branch Agent: Setup and Execution

The **Branch Agent** is a lightweight node service designed to run on the same local network as the biometric hardware (ZKTeco devices). It acts as a bridge, converting REST API calls from the central BITS server into the proprietary TCP protocol required by the devices.

### 1. Configuration
The agent requires connectivity to both the central API server and the local biometric devices.
1. Create a `.env` in the `agent/` directory using the `.env.example`.
2. Configure `CENTRAL_SERVER_URL`: The URL of your deployed BITS backend.
3. Configure `AGENT_TOKEN`: A unique shared secret used to authenticate the agent with the central server to prevent unauthorized command execution.

### 2. Execution

**Using Portainer (For Local Network Deployment):**
1. Copy the contents of [agent/docker-compose.yml](bits/agent/docker-compose.yml) into Portainer as a new Stack.
2. In Portainer, define the following Environment Variables in the stack:
   * `BITS_CLOUD_URL` (e.g., `wss://bits.abas.ph` or your cloud server URL)
   * `AGENT_TOKEN` (the authentication token you generated for the branch)
   * `DEVICES` (e.g., `192.168.1.201:4370`)
   * `AGENT_LABEL` (optional label for the branch agent)
3. Deploy the Stack. Portainer will build and run the agent container locally, bridging local devices to the cloud.

**Manual Setup (Local Network Command Line):**
If the device network is isolated from the central server, run the agent locally:
```bash
cd agent
npm install
npm run build
# Ensure variables are set in .env
npm start
```

### 3. Workflow
- **Handshake**: On startup, the agent initiates a WebSocket connection to the backend.
- **Command Routing**: The backend queues "sync" or "fetch" tasks. When the agent is connected, the backend pushes commands through the socket.
- **Biometric Processing**: The agent interacts with the hardware via TCP (Port 4370), processes fingerprints/logs, and reports status updates back to the API.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Docker](https://www.docker.com/) & Docker Compose
- PostgreSQL 15 (if running locally without Docker)

### Docker (Recommended)

Both Docker Compose files ship with **built-in `${VAR:-default}` fallbacks**, so the stack works out of the box without any `.env` file. Only set up a `.env` if you want to override secrets, credentials, or `FRONTEND_URL`.

> **Auto-setup on first run:** When the containers start, the backend automatically runs `prisma migrate deploy` and seeds the database (default admin/HR accounts & config). The seed is guarded by a `.seeded_lock` file so it only runs **once** — subsequent restarts skip it safely.

1. **Choose your running mode and copy the matching env template:**

   - **Option A: Development Mode (Hot-Reloading)** — `docker-compose.yml`

     Uses bind mounts so code changes are reflected in real time. Copy the **local** template:

     ```bash
     # Windows Command Prompt (cmd.exe):
     copy .env.local.example .env

     # PowerShell / Linux / macOS:
     cp .env.local.example .env
     ```

     Then run:

     ```bash
     docker-compose up --build
     ```

   - **Option B: Production / Deployment Mode** — `docker-compose.prod.yml`

     Code is baked into the container images (no bind mounts). Copy the **docker** template:

     ```bash
     # Windows Command Prompt (cmd.exe):
     copy .env.docker.example .env

     # PowerShell / Linux / macOS:
     cp .env.docker.example .env
     ```

     Then run:

     ```bash
     docker compose -f docker-compose.prod.yml up --build
     ```

2. **Fill in secrets (both modes):**

   Open the `.env` you just created and set at minimum:

   - `JWT_SECRET` and `JWT_REFRESH_SECRET` — replace the placeholder values
   - `SMTP_USER` / `SMTP_PASS` — only if you need email notifications

3. **Set `FRONTEND_URL` if needed:**

   The fallback is `http://localhost:3000`. Update it to match the mapped Docker host port:

   ```env
   FRONTEND_URL=http://localhost:3013
   ```

   Or your server's LAN IP for network access (e.g. `http://192.168.1.50:3013`).

4. **Access the application:**

   Once the containers are running (in either mode), access the services at:

   | Service  | URL                  |
   | -------- | -------------------- |
   | Frontend | http://localhost:3013 |
   | Backend  | http://localhost:4013 |
   | Postgres | `localhost:5013`     |

### Local Development (No Docker)

> **Note:** The `.env` file lives at the project root. Running Prisma CLI commands directly inside `backend/` will fail with `Environment variable not found: DATABASE_URL` unless you follow the steps below.

1. **Copy the local env template:**

   ```bash
   # Windows Command Prompt (cmd.exe):
   copy .env.local.example .env

   # PowerShell / Linux / macOS:
   cp .env.local.example .env
   ```

   Open `.env` and update `DATABASE_URL` (and `DB_*` fields) to match your local PostgreSQL instance:

   ```env
   DATABASE_URL=postgresql://postgres:root@127.0.0.1:5432/db_bits
   ```

2. **Install backend dependencies:**

   ```bash
   cd backend
   npm install
   ```

3. **Run database migrations:**

   Run from the **project root** so Prisma can find the root `.env`:

   - **Option A: Run from the project root (Recommended)**

     ```bash
     npx --prefix backend prisma migrate dev --schema=backend/prisma/schema.prisma
     ```

   - **Option B: Copy `.env` into the backend directory**

     ```bash
     # Windows CMD:
     copy .env backend\.env

     # macOS/Linux/PowerShell:
     cp .env backend/.env

     # Then from inside backend/:
     npx prisma migrate dev
     ```

4. **Seed the database & start the backend:**

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


## Environment Variables Reference

### BITS Backend / Server Variables (Root `.env`)

| Variable Name | Description | Default Value | Required in Production? |
| --- | --- | --- | --- |
| `DB_USER` | PostgreSQL Username | `root` | Recommended to change |
| `DB_PASSWORD` | PostgreSQL Password | `root` | **Yes** (Change to strong secret) |
| `DB_NAME` | PostgreSQL Database Name | `db_bits` | No |
| `DATABASE_URL` | Prisma DB connection URL *(Local dev only)* | `postgresql://root:root@127.0.0.1:5432/db_bits` | No (derived inside Docker) |
| `JWT_SECRET` | Secret key used to sign Access Tokens | `your-secret-key-change-this-in-production` | **Yes** (Change to strong secret) |
| `JWT_REFRESH_SECRET` | Secret key used to sign Refresh Tokens | `your-refresh-secret-key-change-this-in-production` | **Yes** (Change to strong secret) |
| `FRONTEND_URL` | Allowed CORS origin (Must match browser URL bar) | `http://localhost:3000` | **Yes** (e.g., `http://192.168.1.50:3013`) |
| `BACKUP_ENCRYPTION_KEY` | Key used to encrypt database backups at rest | `bits-backup-secure-encryption-key-2026` | **Yes** (Change to strong secret) |
| `BIOMETRIC_ENCRYPTION_KEY` | Key used to encrypt biometric template caches | `bits-biometric-secure-encryption-key-2026` | **Yes** (Change to strong secret) |
| `SMTP_HOST` | Outgoing SMTP server address | `smtp.gmail.com` | Optional |
| `SMTP_PORT` | Outgoing SMTP port | `587` | Optional |
| `SMTP_USER` | Outgoing SMTP email account username | *(Empty)* | Optional (Required for credentials) |
| `SMTP_PASS` | Outgoing SMTP email account app password | *(Empty)* | Optional (Required for credentials) |

### Branch Agent Variables (`agent/.env`)

| Variable Name | Description | Default Value | Required? |
| --- | --- | --- | --- |
| `BITS_CLOUD_URL` | WebSocket URL of the central BITS server | `ws://localhost:3001` | **Yes** (Use `wss://` in prod) |
| `AGENT_TOKEN` | Unique authentication token matching hashed DB records | `agent_token_here` | **Yes** |
| `DEVICES` | Comma-separated local ZKTeco devices (`IP:Port`) | `192.168.1.201:4370` | **Yes** |
| `AGENT_LABEL` | Optional identification name for this agent | `Branch Office Agent` | No |

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
