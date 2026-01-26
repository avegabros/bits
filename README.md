# BITS - Full Stack Application

A modern full-stack application with Next.js frontend and Express.js backend, containerized with Docker.

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS
- **Backend**: Express.js with TypeScript, PostgreSQL
- **Database**: PostgreSQL 15
- **Containerization**: Docker & Docker Compose

## Quick Start

1. Clone the repository
2. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Database: localhost:5432

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/test-db` - Test database connection

## Development

### Frontend
```bash
cd frontend
npm run dev
```

### Backend
```bash
cd backend
cp .env.example .env
npm run dev
```

### Database
PostgreSQL runs on port 5432 with default credentials:
- Database: `app`
- User: `postgres`
- Password: `password`

## Project Structure

```
├── frontend/          # Next.js application
├── backend/           # Express.js application
├── docker-compose.yml # Docker orchestration
└── README.md
```

HELLO OJTS!