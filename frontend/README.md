# 🖥️ BITS — Frontend Portal

[![Next.js](https://img.shields.io/badge/Next.js-16.x-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

The BITS frontend is a **Next.js 16 web portal** that serves four distinct role-based dashboards — Admin, HR, Manager, and Employee — each with their own layouts, navigation, and feature sets. It communicates with the Express backend API via a server-side proxy.

---

## 📌 Responsibilities

- **Role-Based Portal Routing** — Separate layout groups for `(admin)`, `(employee)`, `hr`, and `manager` with dedicated sidebars, topbars, and protected routes.
- **Attendance Dashboards** — Interactive tables and views for reviewing biometric check-in/out records, filtering by date and employee.
- **Adjustment & Overtime Workflows** — Employees submit adjustment requests and overtime requests; managers and HR can review and approve them.
- **Biometric Enrollment UI** — Trigger fingerprint and RFID card enrollment directly from the employee profile page.
- **Device Management** — Configure, monitor, and sync ZKTeco biometric devices.
- **Reports & Exports** — Generate attendance reports with `Recharts` visualizations and export to Excel/CSV.
- **Organization Management** — Manage companies, branches, departments, shifts, and holidays.
- **User Accounts** — Admin-level user creation, role assignment, and password management.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js |
| **UI Library** | React 19 |
| **Language** | TypeScript 5.x |
| **Styling** | Tailwind CSS v4, `tw-animate-css` |
| **UI Primitives** | Radix UI (`Dialog`, `Select`, `Switch`, `Toast`, `Label`) |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **HTTP Client** | Axios |
| **Date Utilities** | date-fns |
| **Theming** | `next-themes` (dark/light mode) |
| **Exports** | `exceljs`, `xlsx`, `xlsx-js-style` |

---

## 📂 Project Structure

```text
frontend/
├── src/
│   ├── app/                          # Next.js App Router root
│   │   ├── layout.tsx                # Root layout with global metadata & providers
│   │   ├── page.tsx                  # Root redirect (→ login or dashboard)
│   │   ├── globals.css               # Global styles and Tailwind base
│   │   ├── (admin)/                  # 🔐 Admin portal route group
│   │   │   ├── layout.tsx            # Admin shell (sidebar + topbar)
│   │   │   ├── dashboard/            # Admin overview dashboard
│   │   │   ├── attendance/           # Biometric attendance table (all employees)
│   │   │   ├── employees/            # Employee list and profile management
│   │   │   ├── devices/              # ZKTeco device management
│   │   │   ├── shifts/               # Shift definitions and assignment
│   │   │   ├── adjustments/          # Attendance adjustment request queue
│   │   │   ├── overtime/             # Overtime request management
│   │   │   ├── holidays/             # Holiday calendar management
│   │   │   ├── branches/             # Branch management
│   │   │   ├── organization/         # Company & department management
│   │   │   ├── reports/              # Report generation
│   │   │   ├── logs/                 # System audit logs
│   │   │   ├── user-accounts/        # User account management
│   │   │   ├── system/               # Sync configuration and health
│   │   │   └── settings/             # Application settings
│   │   ├── (auth)/                   # 🔓 Public auth route group
│   │   │   └── login/                # Login page
│   │   ├── (employee)/               # 👤 Employee self-service route group
│   │   │   └── employee/             # Employee portal dashboard
│   │   ├── hr/                       # 🧑‍💼 HR portal route group
│   │   └── manager/                  # 👔 Manager portal route group
│   ├── components/
│   │   ├── layout/                   # Role-specific shells
│   │   │   ├── admin-layout.tsx      # Admin layout wrapper
│   │   │   ├── admin-sidebar.tsx     # Admin navigation sidebar
│   │   │   ├── admin-topbar.tsx      # Admin top header bar
│   │   │   ├── employee-layout.tsx   # Employee layout wrapper
│   │   │   ├── employee-sidebar.tsx  # Employee navigation sidebar
│   │   │   ├── hr-layout.tsx         # HR layout wrapper
│   │   │   ├── hr-sidebar.tsx        # HR navigation sidebar
│   │   │   ├── manager-layout.tsx    # Manager layout wrapper
│   │   │   └── manager-sidebar.tsx   # Manager navigation sidebar
│   │   └── ui/                       # Shared UI primitives (shadcn/ui style)
│   ├── features/                     # Feature modules (co-located components, hooks, types)
│   │   ├── attendance/               # Attendance tables and edit modals
│   │   ├── auth/                     # Login form, auth layout, session logic
│   │   ├── biometrics/               # Fingerprint & RFID card enrollment modals
│   │   ├── dashboard/                # Admin dashboard widgets
│   │   ├── devices/                  # Device cards, config modals, sync status
│   │   ├── employee-portal/          # Employee self-service views
│   │   ├── employees/                # Employee list, profile page, scan modals
│   │   ├── holidays/                 # Holiday management UI
│   │   ├── hr-portal/                # HR-specific portal views
│   │   ├── manager-portal/           # Manager-specific portal views
│   │   ├── organization/             # Companies, branches, departments
│   │   ├── overtime/                 # Overtime request forms and tables
│   │   ├── reports/                  # Report filters, charts, export buttons
│   │   ├── settings/                 # Settings panels
│   │   ├── shifts/                   # Shift configuration UI
│   │   ├── system/                   # Sync config and health monitor
│   │   ├── system-logs/              # Audit log viewer
│   │   └── user-accounts/            # User account management UI
│   ├── context/                      # React context providers (auth, theme, etc.)
│   ├── hooks/                        # Shared custom React hooks
│   ├── lib/                          # API client, utility functions
│   ├── types/                        # Global TypeScript type definitions
│   └── proxy.ts                      # Server-side backend proxy configuration
├── public/                           # Static assets
├── next.config.ts                    # Next.js configuration (standalone output, rewrites)
├── Dockerfile                        # Frontend container build
└── package.json
```

---

## 🔐 Portal Route Groups

The app uses Next.js **Route Groups** to isolate layouts per role without affecting the URL structure:

| Route Group | URL Prefix | Roles | Layout |
| :--- | :--- | :--- | :--- |
| `(admin)` | `/dashboard`, `/employees`, `/devices`, etc. | `ADMIN` | Admin sidebar + topbar |
| `(auth)` | `/login` | Everyone | Full-page auth layout |
| `(employee)` | `/employee` | `USER` | Employee sidebar + topbar |
| `hr/` | `/hr` | `HR` | HR sidebar + topbar |
| `manager/` | `/manager` | `MANAGER` | Manager sidebar + topbar |

---

## 🚀 Running the Frontend

### A. Docker (Recommended for the shared Pi environment)

The frontend is part of the root `docker-compose.yml` stack.

```bash
# Rebuild and start frontend only
docker-compose up -d --build frontend

# View live frontend logs
docker-compose logs -f frontend
```

> **Port Reminder:** Ensure `frontend.ports` in `docker-compose.yml` is set to your assigned port (e.g., `3013:3000`) before running.

### B. Local Development (Without Docker)

Ensure the backend service is running and your `.env` file at the root is configured.

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

The portal will be available at `http://localhost:3000`.

---

## 📜 NPM Scripts Reference

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server with hot reload. |
| `npm run build` | Compiles and exports a production-ready build. |
| `npm run start` | Serves the production build (requires `npm run build` first). |
| `npm run lint` | Runs ESLint to check for code quality issues. |

---

## ⚠️ Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| API calls return `ECONNREFUSED` | Verify backend is running. For Docker setups, ensure `BACKEND_URL` is set to `http://backend:3001` (either dynamically at runtime in dev compose, or at build-time in the Dockerfile for production builds). |
| Blank page after login | Check browser console for hydration errors; ensure `NODE_ENV` is correctly set. |
| `Module not found` on install | Delete `node_modules` and `.next`, then re-run `npm install`. |
| Hot reload not working in Docker | Ensure `WATCHPACK_POLLING=true` and `CHOKIDAR_USEPOLLING=true` are set in `docker-compose.yml`. |
| Build fails on `next@16` | Confirm `package.json` specifies a valid, released version of Next.js. |
