import { prisma } from '../../shared/lib/prisma';
import { processAttendanceLogs } from '../../modules/attendance/attendance-processor';
import { toPHTDate } from '../../modules/attendance/attendance-utils';
import * as fs from 'fs';
import * as path from 'path';

// Define CLI color helpers
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    bgBlue: '\x1b[44m',
    white: '\x1b[37m'
};

interface ShiftConfig {
    shiftCode: string;
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes: number;
    workDays: string[];
    sortOrder: number;
    isPrimary: boolean;
}

interface OvertimeConfig {
    startTime: string;
    endTime: string;
    status: string;
    reason?: string;
}

interface PunchConfig {
    timestamp: string; // ISO date string or local datetime (e.g. 2026-06-03T09:12:00+08:00)
    type: 'IN' | 'OUT';
}

interface SimulationConfig {
    referenceDate: string; // YYYY-MM-DD
    employee: {
        firstName: string;
        lastName: string;
    };
    shifts: ShiftConfig[];
    overtimes: OvertimeConfig[];
    punches: PunchConfig[];
    syncConfigOverrides: {
        globalMinCheckoutMinutes: number;
        minShiftGapMinutes: number;
        shiftBufferMinutes: number;
    };
    simulationMode: 'sequential' | 'batch';
}

const defaultConfig: SimulationConfig = {
    referenceDate: "2026-06-03",
    employee: {
        firstName: "Simulated",
        lastName: "Employee"
    },
    shifts: [
        {
            shiftCode: "S_MORN",
            name: "Morning Shift (9-12)",
            startTime: "09:00",
            endTime: "12:00",
            graceMinutes: 15,
            workDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            sortOrder: 1,
            isPrimary: false
        },
        {
            shiftCode: "S_AFT",
            name: "Afternoon Shift (14-16)",
            startTime: "14:00",
            endTime: "16:00",
            graceMinutes: 15,
            workDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            sortOrder: 2,
            isPrimary: true
        }
    ],
    overtimes: [
        {
            startTime: "16:00",
            endTime: "18:00",
            status: "APPROVED",
            reason: "Simulated Overtime Work"
        }
    ],
    punches: [
        { timestamp: "2026-06-03T09:12:00+08:00", type: "IN" },
        { timestamp: "2026-06-03T16:00:00+08:00", type: "OUT" }
    ],
    syncConfigOverrides: {
        globalMinCheckoutMinutes: 120,
        minShiftGapMinutes: 30,
        shiftBufferMinutes: 120
    },
    simulationMode: "sequential"
};

function printHelp() {
    console.log(`
${colors.bright}${colors.cyan}Attendance Punch-In & Shift Resolution Simulator${colors.reset}
--------------------------------------------------
Usage:
  npx ts-node src/scripts/debug/attendance-simulator.ts [config-file.json] [flags]

Flags:
  --no-cleanup, -nc    Keep simulated employees, shifts, and records in database for manual inspection.
  --help, -h           Show this help message.

Customizing Scenarios:
  A default ${colors.yellow}simulation-config.json${colors.reset} will be created in the current directory if no file is provided.
  You can customize this JSON file to test any multi-shift, rest-day, or overtime punch-in/out scenarios.
`);
}

async function main() {
    // Parse arguments
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        return;
    }

    const noCleanup = args.includes('--no-cleanup') || args.includes('-nc');
    const cleanArgs = args.filter(a => a !== '--no-cleanup' && a !== '-nc');

    let configFilePath = cleanArgs[0];
    if (!configFilePath) {
        configFilePath = 'simulation-config.json';
    }

    const fullPath = path.resolve(configFilePath);
    let config: SimulationConfig;

    if (!fs.existsSync(fullPath)) {
        if (configFilePath === 'simulation-config.json') {
            fs.writeFileSync(fullPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
            console.log(`${colors.green}Created sample configuration file:${colors.reset} ${colors.yellow}${configFilePath}${colors.reset}`);
            config = defaultConfig;
        } else {
            console.error(`${colors.red}Error: Config file not found:${colors.reset} ${configFilePath}`);
            process.exit(1);
        }
    } else {
        try {
            config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            console.log(`${colors.cyan}Loaded configuration file:${colors.reset} ${colors.yellow}${configFilePath}${colors.reset}`);
        } catch (e: any) {
            console.error(`${colors.red}Error parsing config JSON file:${colors.reset} ${e.message}`);
            process.exit(1);
        }
    }

    // Reference Date and database dates
    const refDate = new Date(config.referenceDate + "T00:00:00Z");
    const dateOnly = toPHTDate(refDate);

    console.log(`\n${colors.bright}${colors.cyan}=== STARTING SIMULATION ===${colors.reset}`);
    console.log(`Reference Date: ${colors.yellow}${config.referenceDate}${colors.reset} (UTC: ${refDate.toISOString()})`);
    console.log(`Simulation Mode: ${colors.yellow}${config.simulationMode}${colors.reset}`);
    if (noCleanup) {
        console.log(`${colors.magenta}⚠️  DB Cleanup Disabled: Test entities will remain in the DB.${colors.reset}`);
    }

    // 1. Manage SyncConfig
    let originalSyncConfig: any = null;
    try {
        originalSyncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
        console.log(`Original SyncConfig loaded.`);
        
        await prisma.syncConfig.upsert({
            where: { id: 1 },
            update: {
                globalMinCheckoutMinutes: config.syncConfigOverrides.globalMinCheckoutMinutes,
                minShiftGapMinutes: config.syncConfigOverrides.minShiftGapMinutes,
                shiftBufferMinutes: config.syncConfigOverrides.shiftBufferMinutes
            },
            create: {
                id: 1,
                globalMinCheckoutMinutes: config.syncConfigOverrides.globalMinCheckoutMinutes,
                minShiftGapMinutes: config.syncConfigOverrides.minShiftGapMinutes,
                shiftBufferMinutes: config.syncConfigOverrides.shiftBufferMinutes
            }
        });
        console.log(`Applied SyncConfig overrides: minCheckout=${config.syncConfigOverrides.globalMinCheckoutMinutes}m, gap=${config.syncConfigOverrides.minShiftGapMinutes}m, buffer=${config.syncConfigOverrides.shiftBufferMinutes}m`);
    } catch (e: any) {
        console.error(`Warning: could not update SyncConfig. Continuing...`, e.message);
    }

    // 2. Clear pre-existing simulated data
    console.log(`Cleaning old test data for employee: ${config.employee.firstName} ${config.employee.lastName}...`);
    const oldEmp = await prisma.employee.findFirst({
        where: { firstName: config.employee.firstName, lastName: config.employee.lastName }
    });

    if (oldEmp) {
        await prisma.attendanceLog.deleteMany({ where: { employeeId: oldEmp.id } });
        await prisma.attendance.deleteMany({ where: { employeeId: oldEmp.id } });
        await prisma.overtimeRequest.deleteMany({ where: { employeeId: oldEmp.id } });
        await prisma.employeeShift.deleteMany({ where: { employeeId: oldEmp.id } });
    }

    // Also remove shifts if we are creating them fresh
    for (const s of config.shifts) {
        const existingShift = await prisma.shift.findFirst({ where: { shiftCode: s.shiftCode } });
        if (existingShift) {
            // Delete any assignments linking to it first
            await prisma.employeeShift.deleteMany({ where: { shiftId: existingShift.id } });
            await prisma.attendance.deleteMany({ where: { shiftId: existingShift.id } });
            await prisma.shift.delete({ where: { id: existingShift.id } });
        }
    }

    // 3. Create simulated employee
    let employee = oldEmp;
    if (!employee) {
        employee = await prisma.employee.create({
            data: {
                firstName: config.employee.firstName,
                lastName: config.employee.lastName,
                role: 'USER',
                employmentStatus: 'ACTIVE',
                updatedAt: new Date()
            }
        });
    }

    // 4. Create Shifts & Assignments
    const dbShifts: any[] = [];
    let primaryShiftId: number | null = null;

    for (const s of config.shifts) {
        const createdShift = await prisma.shift.create({
            data: {
                shiftCode: s.shiftCode,
                name: s.name,
                startTime: s.startTime,
                endTime: s.endTime,
                graceMinutes: s.graceMinutes,
                breakMinutes: 0,
                isActive: true,
                workDays: JSON.stringify(s.workDays)
            }
        });
        dbShifts.push(createdShift);
        console.log(`Created Shift: ${colors.green}${s.shiftCode}${colors.reset} (${s.startTime} - ${s.endTime})`);

        if (s.isPrimary) {
            primaryShiftId = createdShift.id;
        }

        // Link assignment
        await prisma.employeeShift.create({
            data: {
                employeeId: employee.id,
                shiftId: createdShift.id,
                sortOrder: s.sortOrder,
                isPrimary: s.isPrimary
            }
        });
    }

    // Link employee default shift
    if (primaryShiftId) {
        await prisma.employee.update({
            where: { id: employee.id },
            data: { shiftId: primaryShiftId }
        });
    }

    // 5. Create Approved Overtime requests
    for (const ot of config.overtimes) {
        await prisma.overtimeRequest.create({
            data: {
                employeeId: employee.id,
                date: dateOnly,
                startTime: ot.startTime,
                endTime: ot.endTime,
                reason: ot.reason || "Simulated Overtime",
                status: ot.status as any
            }
        });
        console.log(`Created OT Request: ${colors.green}${ot.startTime} - ${ot.endTime}${colors.reset} [${ot.status}]`);
    }

    // 6. Punch Simulation
    // Sort punches by chronological timestamp
    const sortedPunches = [...config.punches].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log(`\nSimulating Punches...`);
    if (config.simulationMode === 'sequential') {
        for (const p of sortedPunches) {
            const punchTime = new Date(p.timestamp);
            console.log(`-> Scanning ${colors.cyan}${p.type}${colors.reset} at ${colors.yellow}${p.timestamp}${colors.reset}`);
            
            await prisma.attendanceLog.create({
                data: {
                    employeeId: employee.id,
                    timestamp: punchTime,
                    status: p.type === 'IN' ? 0 : 1
                }
            });

            // Process immediately
            const result = await processAttendanceLogs();
            console.log(`   [Logs Processed] Success: ${result.success}, Processed: ${result.processed}, Created: ${result.created}, Updated: ${result.updated}`);
        }
    } else {
        // Batch mode: insert all logs first, then call processAttendanceLogs once
        for (const p of sortedPunches) {
            const punchTime = new Date(p.timestamp);
            console.log(`-> Queueing ${colors.cyan}${p.type}${colors.reset} at ${colors.yellow}${p.timestamp}${colors.reset}`);
            await prisma.attendanceLog.create({
                data: {
                    employeeId: employee.id,
                    timestamp: punchTime,
                    status: p.type === 'IN' ? 0 : 1
                }
            });
        }
        console.log(`Processing batch logs...`);
        const result = await processAttendanceLogs();
        console.log(`[Batch Process Result] Success: ${result.success}, Processed: ${result.processed}, Created: ${result.created}, Updated: ${result.updated}`);
    }

    // 7. Fetch results & Display
    const finalAttendance = await prisma.attendance.findMany({
        where: { employeeId: employee.id, date: dateOnly },
        include: { shift: true }
    });

    console.log(`\n${colors.bright}${colors.cyan}=== SIMULATION RESULTS ===${colors.reset}`);
    console.log(`Total Attendance Records Created: ${colors.yellow}${finalAttendance.length}${colors.reset}`);

    if (finalAttendance.length === 0) {
        console.log(`${colors.red}No attendance records were created.${colors.reset}`);
    } else {
        finalAttendance.forEach((att, index) => {
            console.log(`\nRecord #${index + 1}:`);
            console.log(`--------------------------------------------------`);
            console.log(`Shift Code:       ${colors.green}${att.shift?.shiftCode ?? 'OT-Only (NULL)'}${colors.reset}`);
            console.log(`Shift Name:       ${att.shift?.name ?? 'Overtime Only'}`);
            console.log(`Check-In Time:    ${colors.cyan}${att.checkInTime.toISOString()}${colors.reset}`);
            console.log(`Check-Out Time:   ${att.checkOutTime ? colors.cyan + att.checkOutTime.toISOString() + colors.reset : colors.red + 'N/A (Open Record)' + colors.reset}`);
            console.log(`Status:           ${colors.bright}${att.status === 'present' ? colors.green : colors.yellow}${att.status}${colors.reset}`);
            console.log(`Late Minutes:     ${att.lateMinutes > 0 ? colors.red + att.lateMinutes + ' mins' : colors.green + '0 mins'}${colors.reset}`);
            console.log(`Undertime Mins:   ${att.undertimeMinutes > 0 ? colors.red + att.undertimeMinutes + ' mins' : colors.green + '0 mins'}${colors.reset}`);
            console.log(`Overtime Mins:    ${att.overtimeMinutes > 0 ? colors.green + att.overtimeMinutes + ' mins' : '0 mins'}`);
            console.log(`Total Hours:      ${colors.yellow}${att.totalHours} hrs${colors.reset}`);
            console.log(`Grace Period:     ${att.gracePeriodApplied ? colors.green + 'Applied' : 'Not Applied'}${colors.reset}`);
            console.log(`Early Out:        ${att.isEarlyOut ? colors.red + 'Yes' : colors.green + 'No'}${colors.reset}`);
            console.log(`Anomaly:          ${att.isAnomaly ? colors.red + 'Yes' : colors.green + 'No'}${colors.reset}`);
        });
        console.log(`--------------------------------------------------`);
    }

    // 8. Cleanup
    if (!noCleanup) {
        console.log(`\nCleaning up simulated records...`);
        await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
        await prisma.attendance.deleteMany({ where: { employeeId: employee.id } });
        await prisma.overtimeRequest.deleteMany({ where: { employeeId: employee.id } });
        await prisma.employeeShift.deleteMany({ where: { employeeId: employee.id } });
        await prisma.employee.delete({ where: { id: employee.id } });

        for (const s of dbShifts) {
            await prisma.shift.delete({ where: { id: s.id } });
        }
        console.log(`Database cleaned up successfully.`);
    }

    // Restore SyncConfig
    if (originalSyncConfig) {
        await prisma.syncConfig.update({
            where: { id: 1 },
            data: {
                globalMinCheckoutMinutes: originalSyncConfig.globalMinCheckoutMinutes,
                minShiftGapMinutes: originalSyncConfig.minShiftGapMinutes,
                shiftBufferMinutes: originalSyncConfig.shiftBufferMinutes
            }
        });
        console.log(`Restored original SyncConfig.`);
    }

    console.log(`\n${colors.bright}${colors.green}=== SIMULATION COMPLETED ===${colors.reset}`);
}

main().catch(async (err) => {
    console.error(`\n${colors.red}Simulation aborted due to error:${colors.reset}`, err);
    process.exit(1);
});
