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

   ```powershell
   cp .env.example .env
   ```

2. **Build and run:**

   ```bash
   docker-compose up --build
   ```

3. **Access the application:**

   | Service  | URL                    |
   | -------- | ---------------------- |
   | Frontend | http://localhost:3013   |
   | Backend  | http://localhost:4013   |
   | Postgres | `localhost:5013`       |

### Production Simulation

```bash
docker compose -f docker-compose.prod.yml up --build
```

No bind mounts — code is baked into Docker images. Upload volumes persist across rebuilds.

### Local Development (No Docker)

**Backend:**

```bash
cd backend
npm install
# Set DATABASE_URL in root .env pointing to your local PostgreSQL
npx prisma migrate deploy    # apply migrations
npx prisma generate          # generate Prisma client
npm run seed                 # seed initial data
npm run dev                  # start dev server (ts-node)
npm run dev:watch            # start with hot reload (nodemon)
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev                  # Next.js dev server on port 3000
```


## Build Notes & Troubleshooting

- If `npm install` fails with `No matching version found for next@...`, update `frontend/package.json` to a valid Next.js version.
- The frontend Dockerfile expects the Next.js standalone build output — ensure `next.config.ts` contains `output: "standalone"` for production builds.
- If the Next.js build detects the wrong workspace root (warning about multiple lockfiles), run build commands from inside the `frontend/` folder or remove extra lockfiles.
- The backend uses `patch-package` — patches in `backend/patches/` are applied automatically via `postinstall`.
- Timezone is set to `Asia/Manila` in Docker containers.
