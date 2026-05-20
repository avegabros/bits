import { calculateAttendanceMetrics } from '../../modules/attendance/attendance-calculator';
import { Prisma } from '@prisma/client';

const mockShift: Prisma.ShiftGetPayload<{}> = {
  id: 1,
  shiftCode: 'MS-02',
  name: 'Half Morning Shift',
  startTime: '08:00',
  endTime: '12:00',
  graceMinutes: 30,
  breakMinutes: 0,
  isNightShift: false,
  isActive: true,
  description: 'Test shift',
  workDays: '["Mon","Tue","Wed","Thu","Fri"]',
  halfDays: '[]',
  halfDayHours: null,
  breaks: '[]',
  createdAt: new Date(),
  updatedAt: new Date()
};

function runTest(checkInTimeStr: string) {
  const date = new Date('2026-02-09T16:00:00Z'); 

  const [ciH, ciM] = checkInTimeStr.split(':').map(Number);
  const checkInTime = new Date(Date.UTC(2026, 1, 10, ciH - 8, ciM));
  const checkOutTime = new Date(Date.UTC(2026, 1, 10, 12 - 8, 0));

  const record = {
    date,
    checkInTime,
    checkOutTime,
    status: 'present'
  };

  console.log(`--- Debug for Check-In ${checkInTimeStr} ---`);
  console.log(`record.date:      ${record.date.toISOString()}`);
  console.log(`checkInTime:      ${record.checkInTime.toISOString()}`);
  console.log(`checkOutTime:     ${record.checkOutTime.toISOString()}`);

  const metrics = calculateAttendanceMetrics(record as any, mockShift, []);
  console.log(`Result Metrics:`, JSON.stringify(metrics, null, 2));
}

runTest('08:15');
runTest('08:31');
