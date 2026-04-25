import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './shared/config/swagger.config';
import { prisma } from './shared/lib/prisma';
import attendanceRoutes from './modules/attendance/attendance.routes';
import authRoutes from './modules/auth/auth.routes';
import employeeRoutes from './modules/employees/employee.routes';
import userRoutes from './modules/users/user.routes';
import departmentRoutes from './modules/organization/department.routes';
import branchRoutes from './modules/organization/branch.routes';
import deviceRoutes from './modules/devices/device.routes';
import systemRoutes from './modules/system/system.routes';
import logsRoutes from './modules/logs/logs.routes';
import shiftRoutes from './modules/shifts/shift.routes';

import timeRoutes from './modules/system/time.routes';
import meRoutes from './modules/me/me.routes';
import profilePictureRoutes from './modules/profile-picture/profilePicture.routes';
import path from 'path';
import { correlationId } from './shared/middleware/correlationId.middleware';

dotenv.config();

const app = express();

// Trust first proxy (Nginx / Docker / cloud LB) so req.ip reflects the real
// client IP from X-Forwarded-For instead of the proxy's internal address.
// Increase this number if there are multiple proxy layers (e.g. Cloudflare → Nginx → Express).
app.set('trust proxy', 1);

// ── CORS config ───────────────────────────────────────────────────────────────
// FRONTEND_URL:
//   LOCAL  → set in backend/.env  (e.g. http://localhost:3010)
//   DOCKER → set in docker-compose.yml (e.g. http://localhost:3010 or server IP)
// Falls back to localhost:3010 so local dev works without any extra config.
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3010';

// ── Security middleware (must come before routes) ──────────────────────────────
app.use(helmet());        // Sets secure HTTP headers on every response
app.use(cookieParser());  // Parses incoming cookies so req.cookies.auth_token is available
app.use(cors({
  origin: allowedOrigin,
  credentials: true,    // Required if we add HttpOnly cookie auth (Phase 4)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(morgan('dev')); // Request logging
app.use(correlationId);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount Routes
app.use('/api/attendance', attendanceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/shifts', shiftRoutes);

app.use('/api/time', timeRoutes);
app.use('/api/me', meRoutes);
app.use('/api/me/profile-picture', profilePictureRoutes);

// ── Static file serving for uploaded avatars ──────────────────────────────────
// Serves files from backend/uploads/avatars/ at /api/uploads/avatars/*
// Cache for 24 hours; cache-busted via ?v=timestamp on the URL
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  maxAge: '1d',
  immutable: true,
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ── Device health endpoint — polled by topbar every 15 seconds ────────────────
// Returns the live isActive status for the primary device (ZK_HOST) from the DB.
// syncZkData updates isActive on every cron tick (every 30s), so this endpoint
// reflects real connectivity without making its own TCP connection.
app.get('/api/health/device', async (req, res) => {
  try {
    const zkHost = process.env.ZK_HOST || '192.168.1.201';

    // Find the device by its IP in the DB
    const device = await prisma.device.findFirst({
      where: { ip: zkHost },
      select: { id: true, name: true, ip: true, port: true, isActive: true, updatedAt: true }
    });

    if (!device) {
      // Device not in DB yet — status unknown
      return res.json({ online: false, status: 'unknown', message: 'Device not registered in system' });
    }

    return res.json({
      online: device.isActive,
      status: device.isActive ? 'online' : 'offline',
      deviceName: device.name,
      ip: device.ip,
      port: device.port,
      lastSeen: device.updatedAt,
    });
  } catch (error: unknown) {
    return res.status(500).json({ online: false, status: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;
    res.json({
      status: 'Database connected',
      result
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'Database connection failed',
      error: 'connection_error' // Sanitize error
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: 'not_found'
  });
});

// Error handling middleware
app.use((err: Error & { status?: number; error?: string }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.error || 'internal_server_error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error'),
    ...(process.env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {})
  });
});

export default app;
