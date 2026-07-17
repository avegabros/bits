import { prisma } from '../shared/lib/prisma';
import { processAttendanceLogs } from '../modules/attendance/attendance-processor';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log(`
Usage:
  npx ts-node src/scripts/simulate-punch.ts <employeeId> <phtTimestamp> <status> [deviceId]

Arguments:
  <employeeId>    The database ID of the employee (e.g. 67)
  <phtTimestamp>  The local Philippine time of the punch in "YYYY-MM-DD HH:mm:ss" format (e.g. "2026-07-16 08:01:00")
  <status>        The biometric punch status:
                    0 = Check-in (Shift Start)
                    1 = Check-out (Shift End)
                    4 = Overtime-In (OT Start)
                    5 = Overtime-out (OT End)
  [deviceId]      Optional: The database ID of the biometric device (e.g. 1)

Example:
  npx ts-node src/scripts/simulate-punch.ts 67 "2026-07-16 08:01:00" 0 1
  npx ts-node src/scripts/simulate-punch.ts 67 "2026-07-16 17:12:00" 1 1
`);
    process.exit(1);
  }

  const employeeId = parseInt(args[0], 10);
  const phtTimestampStr = args[1];
  const status = parseInt(args[2], 10);
  
  const deviceIdArg = args[3];
  let deviceId: number | null = null;
  if (deviceIdArg) {
    deviceId = parseInt(deviceIdArg, 10);
    if (isNaN(deviceId)) {
      console.error('Error: deviceId must be a number.');
      process.exit(1);
    }
  }

  if (isNaN(employeeId)) {
    console.error('Error: employeeId must be a number.');
    process.exit(1);
  }

  if (isNaN(status) || ![0, 1, 4, 5].includes(status)) {
    console.error('Error: status must be 0, 1, 4, or 5.');
    process.exit(1);
  }

  // Parse local Philippine Time to UTC
  // Format: "YYYY-MM-DD HH:mm:ss" -> ISO string with +08:00 timezone offset
  const isoPhtStr = phtTimestampStr.trim().replace(' ', 'T') + '+08:00';
  const timestamp = new Date(isoPhtStr);

  if (isNaN(timestamp.getTime())) {
    console.error('Error: Invalid timestamp format. Use "YYYY-MM-DD HH:mm:ss"');
    process.exit(1);
  }

  console.log(`\n--- Simulating Biometric Punch ---`);
  console.log(`Employee ID: ${employeeId}`);
  console.log(`PHT Punch Time: ${phtTimestampStr}`);
  console.log(`UTC Equivalency: ${timestamp.toISOString()}`);
  console.log(`Punch Status: ${status} (${status === 0 ? 'Check-in' : status === 1 ? 'Check-out' : status === 4 ? 'Overtime-In' : 'Overtime-out'})`);
  console.log(`Device ID: ${deviceId !== null ? deviceId : 'None (System Default)'}`);

  try {
    // 1. Verify employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { Shift: true }
    });

    if (!employee) {
      console.error(`Error: Employee with ID ${employeeId} not found in database.`);
      process.exit(1);
    }

    console.log(`Found Employee: ${employee.firstName} ${employee.lastName} (Current Shift: ${employee.Shift?.name || 'No Shift'})`);

    // Verify device exists if specified
    if (deviceId !== null) {
      const device = await prisma.device.findUnique({
        where: { id: deviceId }
      });
      if (!device) {
        console.warn(`Warning: Device with ID ${deviceId} not found in database. The log will be created with this deviceId.`);
      } else {
        console.log(`Device resolved: "${device.name}" (IP: ${device.ip})`);
      }
    }

    // 2. Insert the biometric log (with processedAt as null)
    console.log(`Inserting AttendanceLog record...`);
    
    // Check if duplicate log exists
    const existingLog = await prisma.attendanceLog.findUnique({
      where: {
        timestamp_employeeId: {
          timestamp,
          employeeId
        }
      }
    });

    if (existingLog) {
      console.log(`Warning: An attendance log for this timestamp and employee already exists (Log ID: ${existingLog.id}).`);
      console.log(`Updating existing log to unprocessed to force re-processing...`);
      await prisma.attendanceLog.update({
        where: { id: existingLog.id },
        data: {
          status,
          deviceId,
          processedAt: null
        }
      });
    } else {
      const log = await prisma.attendanceLog.create({
        data: {
          employeeId,
          timestamp,
          status,
          deviceId,
          processedAt: null,
          authMethod: 'FP'
        }
      });
      console.log(`AttendanceLog created successfully (Log ID: ${log.id}).`);
    }

    // 3. Trigger attendance log processing
    console.log(`Invoking attendance log processor...`);
    const processResult = await processAttendanceLogs();
    console.log(`Processor results:`, processResult);

    console.log(`\nSimulation completed successfully! ✅`);
  } catch (error) {
    console.error('Simulation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
