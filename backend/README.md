# 🔌 BITS — Backend Service

[![Express.js](https://img.shields.io/badge/Express.js-5.x-lightgrey?style=for-the-badge&logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-blue?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

The BITS backend is a **REST API service** built with Express.js and TypeScript. It is the central hub for all attendance data, employee management, ZKTeco biometric device integration, and scheduled background tasks.

---

## 📌 Responsibilities

- **Authentication & Authorization** — JWT-based login with refresh tokens, bcrypt password hashing, and Role-Based Access Control (RBAC: `USER`, `HR`, `MANAGER`, `ADMIN`).
- **Attendance Engine** — Processes raw biometric logs from ZKTeco devices into structured attendance records: computes late minutes, undertime, overtime, break durations, and flags anomalies.
- **ZKTeco Device Communication** — Manages real-time TCP/IP socket connections to fingerprint/RFID terminals for user sync, log fetching, and remote fingerprint enrollment.
- **Employee Management** — Full CRUD for employee profiles, department/branch/shift assignments, and biometric device enrollments.
- **Scheduled Tasks** — `node-cron` jobs for automated sync, device health checks, and log buffer maintenance.
- **Reporting** — Excel/CSV generation via `exceljs` and structured JSON report endpoints.
- **Email Notifications** — SMTP-based transactional emails (credential delivery, status updates) via `nodemailer`.
- **Audit Logging** — Immutable action trail stored in the `AuditLog` table with correlation IDs, categories, and levels.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime** | Node.js 18+ |
| **Language** | TypeScript 5.x |
| **Framework** | Express.js 5.x |
| **ORM** | Prisma ORM 6.x |
| **Database** | PostgreSQL 15 |
| **Biometric Driver** | `node-zklib` / `zklib-js` (pure JS, no Python) |
| **Authentication** | JWT (`jsonwebtoken`), `bcryptjs` |
| **Scheduled Jobs** | `node-cron` |
| **Validation** | `express-validator`, `zod` |
| **Security** | `helmet`, `express-rate-limit`, `cors`, `cookie-parser` |
| **File Handling** | `multer`, `sharp` (image optimization) |
| **Email** | `nodemailer` (SMTP/Gmail App Password) |
| **Reports** | `exceljs`, `xlsx`, `xlsx-js-style` |
| **API Docs** | Swagger UI (`swagger-jsdoc`, `swagger-ui-express`) |

---

## 📂 Project Structure

The backend follows a **feature-module** architecture. Business logic is co-located with the feature it belongs to, and shared infrastructure lives in `src/shared/`.

```text
backend/
├── src/
│   ├── app.ts                  # Express app setup (routes, middleware, Swagger)
│   ├── index.ts                # Server entrypoint (port binding, startup)
│   ├── modules/                # Feature modules (self-contained, domain-driven)
│   │   ├── attendance/         # Attendance records, adjustments, overtime requests
│   │   ├── auth/               # Login, logout, token refresh
│   │   ├── devices/            # ZKTeco device management, sync tasks, biometric exclusions
│   │   ├── employees/          # Employee CRUD, biometric enrollment controllers
│   │   ├── holidays/           # Holiday management per branch
│   │   ├── logs/               # Audit log query endpoints
│   │   ├── me/                 # Employee self-service portal endpoints
│   │   ├── organization/       # Companies, branches, departments
│   │   ├── profile-picture/    # Avatar upload and serving
│   │   ├── reports/            # Report generation endpoints
│   │   ├── shifts/             # Shift configuration and assignment
│   │   ├── system/             # Sync config, health checks
│   │   └── users/              # Admin user management
│   ├── scripts/                # One-off utility and maintenance scripts
│   │   ├── sync/               # Device sync scripts (enrollFingerprint, syncEmployees, etc.)
│   │   ├── export/             # CSV/data export scripts
│   │   ├── debug/              # ZK device inspection scripts
│   │   └── maintenance/        # Retroactive checkout, timezone fixes, etc.
│   └── shared/                 # Cross-cutting infrastructure
│       ├── config/             # Swagger config, app-level config
│       ├── events/             # Internal event bus
│       ├── lib/                # Core drivers and singletons
│       │   ├── zk-driver.ts    # ⭐ ZKTeco TCP socket driver (CMD_STARTENROLL, getLogs, etc.)
│       │   ├── prisma.ts       # Prisma client singleton
│       │   ├── cronJobs.ts     # Cron job definitions and scheduler
│       │   ├── auditLogger.ts  # Structured audit log writer
│       │   └── email.service.ts # SMTP email sender
│       ├── middleware/         # Auth, RBAC, correlation ID, error handler, validation
│       ├── services/           # Shared service layer (email, file storage)
│       ├── types/              # Shared TypeScript types and interfaces
│       └── utils/              # Utility helpers
├── prisma/
│   ├── schema.prisma           # Full database schema (all models and enums)
│   └── seed.ts                 # Database seed script
├── uploads/                    # Persisted avatar image files
├── Dockerfile                  # Backend container build
└── package.json
```

---

## 🤖 ZKTeco Device Integration

The `ZKDriver` class in `src/shared/lib/zk-driver.ts` wraps the raw ZK binary protocol over a TCP socket connection.

### Key Driver Methods

| Method | Description |
| :--- | :--- |
| `connect()` | Establishes a session with the ZKTeco terminal. |
| `disconnect()` | Gracefully ends the session. |
| `getLogs()` | Fetches the raw attendance log buffer from the device. |
| `getUsers()` | Downloads all enrolled user records from the device. |
| `setUser(id, name, ...)` | Uploads / updates an employee record on the device. |
| `deleteUser(zkId)` | Removes a user from the device. |

> **Important:** The device only supports **one active TCP connection at a time**. A sync job holding the socket will prevent device menu access, and vice versa.

### Fingerprint Enrollment Flow

Remote enrollment is not natively trivial in the ZK protocol. The system implements a custom handshake sequence:

1. **Sync User** — Ensure the employee record exists on the target device.
2. **CMD_STARTENROLL** — The server sends the enroll command with the finger index.
3. **Physical Action** — The employee presses their finger **3 times** on the device terminal.
4. **Template Saved** — The device stores the biometric template internally.

> **Security Note:** Fingerprint templates are **never stored in our database**. The device handles all biometric data at the hardware level.

---

## 🚀 Running the Backend

### A. Docker (Recommended for the shared Pi environment)

The backend is part of the root `docker-compose.yml` stack.

```bash
# Rebuild and start backend only
docker-compose up -d --build backend

# View live backend logs
docker-compose logs -f backend
```

> **Port Reminder:** Make sure the port mappings in `docker-compose.yml` match your assigned ports from the OJT port table before running.

### B. Local Development (Without Docker)

Ensure you have **Node.js 18+** and a local **PostgreSQL** instance running, and that your `.env` file is configured (see root `README.md`).

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev

# 3. (Optional) Seed the database
npm run seed

# 4. Start the development server with hot-reload
npm run dev:watch
```

### C. API Documentation (Swagger UI)

Once the server is running, the full interactive API reference is available at:

- **Local:** `http://localhost:3001/api-docs`
- **Docker (your port):** `http://pi5.local:4013/api-docs`

---

## 📜 NPM Scripts Reference

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the server via `ts-node` (no rebuild needed). |
| `npm run dev:watch` | Runs with `nodemon` — restarts on file changes. |
| `npm run build` | Compiles TypeScript to `dist/`. |
| `npm run start` | Runs the compiled JS from `dist/index.js`. |
| `npm run seed` | Seeds the database using `prisma/seed.ts`. |
| `npm run assign-zkids` | Assigns ZK device IDs to existing employees. |
| `npm run sync-employees` | Pushes all employees to the biometric device. |
| `npm run sync-employees-from-device` | Pulls users from the device back into the database. |
| `npm run export-employees-csv` | Exports all employees to a CSV file. |
| `npm run enroll-fingerprint` | Triggers fingerprint enrollment for an employee. |
| `npm run retroactive-checkout` | Backfills missing checkout records. |
| `npm run fix-timezone` | Corrects timezone offsets in historical attendance data. |
| `npm run debug-device-users` | Inspects raw user data from the ZKTeco device. |

---

## ⚠️ Troubleshooting

### ZKTeco Device Connection Issues

| Symptom | Likely Cause | Fix |
| :--- | :--- | :--- |
| `Connection timeout` | Wrong IP or device is off/unreachable | Verify `ZK_HOST` in `.env` is correct and on the same LAN. |
| `Device busy` | Another session is already active | Wait for the current sync cycle to complete (check logs). |
| `ECONNREFUSED` | Device port blocked | Ensure port `4370` (UDP/TCP) is not blocked by the router. |

### Database / Prisma Issues

```bash
# Regenerate the Prisma client after schema changes
npx prisma generate

# Apply pending migrations
npx prisma migrate dev

# Open the visual database browser
npx prisma studio
```
