# Full Stack Application Scaffold

A modern full-stack application with Next.js frontend and Express.js backend, containerized with Docker.

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS
- **Backend**: Express.js with TypeScript, PostgreSQL
- **Database**: PostgreSQL 15
- **Containerization**: Docker & Docker Compose

## Quick Start

# Full Stack Application Scaffold

A modern full-stack application with a Next.js frontend and an Express.js backend, containerized with Docker.

## Quick Start (Docker)

1. Copy any necessary env files for services (backend, DB):

```powershell
cp backend/.env.example backend/.env
```

2. Build and run with Docker Compose:

```bash
docker-compose up --build
```

The application will be available at:

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

If you prefer to build the frontend image manually:

```bash
docker build -t frontend:local frontend
docker run -p 3000:3000 frontend:local
```

## Local development (no Docker)

Frontend:

```bash
cd frontend
npm install
npm run dev            # development server
# or for production build
npm run build
npm run start
```

Backend (example):

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

## Build notes and troubleshooting

- If `npm install` fails with `No matching version found for next@...`, update `frontend/package.json` to a valid Next.js version.
- The Dockerfile expects the Next standalone build output at `/app/.next/standalone` — make sure `next.config.ts` contains `output: "standalone"`.
- If the Next build detects the wrong workspace root (warning about multiple lockfiles), ensure you're running build commands from the `frontend` folder, or remove extra lockfiles.

## Project Structure

```
├── frontend/          # Next.js application
├── backend/           # Express.js application
├── docker-compose.yml # Docker orchestration
└── README.md
```
