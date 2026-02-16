import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.config';
import { prisma } from './lib/prisma';
import attendanceRoutes from './routes/attendance_routes';
import authRoutes from './routes/auth_routes';
import employeeRoutes from './routes/employee_routes';
import { startCronJobs } from './lib/cronJobs';
import { repairMissingCheckouts } from './services/attendance.service';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());

app.use(express.json());
app.use(morgan('dev')); // Request logging

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount Routes
app.use('/api/attendance', attendanceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.error || 'internal_server_error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error'),
    ...(process.env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {})
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);

  // Run startup repair for missing checkouts
  repairMissingCheckouts();

  // Initialize automated cron jobs
  startCronJobs();
});