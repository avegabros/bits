import app from './app';
import { startCronJobs } from './shared/lib/cronJobs';
import { repairMissingCheckouts } from './modules/attendance/attendance.service';
import { initAgentGateway } from './modules/devices/agent-gateway.service';

const port = process.env.PORT || 3001;

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions — log but keep server alive to avoid JSON parse errors on the frontend
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Do NOT call process.exit(1) — if we crash here the frontend gets no JSON response
  // which causes "Unexpected token I" parse errors. Log and continue instead.
});

const server = app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);

  // Run startup repair for missing checkouts
  repairMissingCheckouts();

  // Initialize automated cron jobs
  startCronJobs();
});

// Initialize WebSocket gateway for branch agents
initAgentGateway(server);

