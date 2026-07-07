  
  
  
  
  
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

// Helper to format UTC Date to local Philippine Time ISO string (e.g. YYYY-MM-DDTHH:mm:ss+08:00)
function formatToLocalISO(date: Date): string {
    const localTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return localTime.toISOString().slice(0, 19) + '+08:00';
}

interface ShiftConfig {
    shiftCode: string;
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes: number;
    breakMinutes?: number;
    breaks?: string | any[];
    workDays: string[];
    halfDays?: string[];
    halfDayHours?: number | null;
    sortOrder: number;
    isPrimary: boolean;
    isNightShift?: boolean;
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
    holiday?: {
        name?: string;
        type?: string;
    };
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
            halfDays: [],
            halfDayHours: null,
            sortOrder: 1,
            isPrimary: false
        },
        {
            shiftCode: "S_AFT",
            name: "Afternoon Shift (14-16)",
            startTime: "14:00",
            endTime: "16:00",
            graceMinutes: 15,
            breakMinutes: 30,
            workDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            halfDays: [],
            halfDayHours: null,
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
    const cutoffMs = Date.now() - 2 * 24 * 60 * 60 * 1000;
    
    // Parse the original reference date from config. If "today", use today's date string.
    const originalRefStr = (config.referenceDate === 'today') 
        ? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : config.referenceDate;

    const originalRefDate = new Date(originalRefStr + "T00:00:00+08:00");
    
    let refDate: Date;
    let autoShifted = false;
    
    if (config.referenceDate === 'today' || originalRefDate.getTime() < cutoffMs) {
        refDate = new Date();
        autoShifted = true;
    } else {
        refDate = originalRefDate;
    }
    
    const dateOnly = toPHTDate(refDate);
    const phtRefDate = new Date(dateOnly.getTime() + 8 * 60 * 60 * 1000);
    const refDateStr = phtRefDate.toISOString().slice(0, 10);

    // Calculate shift in milliseconds: targetRefDatePHT - originalRefDate
    const targetRefDatePHT = new Date(refDateStr + "T00:00:00+08:00");
    const dateShiftMs = targetRefDatePHT.getTime() - originalRefDate.getTime();

    // Map punches to preserve their relative day difference from the original reference date
    config.punches = config.punches.map(p => {
        const originalPunchTime = new Date(p.timestamp);
        const shiftedPunchTime = new Date(originalPunchTime.getTime() + dateShiftMs);
        const phtTime = new Date(shiftedPunchTime.getTime() + 8 * 60 * 60 * 1000);
        const timestampPHT = phtTime.toISOString().slice(0, 19) + '+08:00';
        return { ...p, timestamp: timestampPHT };
    });

    console.log(`\n${colors.bright}${colors.cyan}=== STARTING SIMULATION ===${colors.reset}`);
    if (autoShifted) {
        console.log(`${colors.yellow}⚠️  Reference date ${config.referenceDate} is older than 48-hour cutoff. Auto-shifting to: ${refDateStr} to bypass the 48-hour cutoff filter.${colors.reset}`);
    } else {
        console.log(`Reference Date: ${colors.yellow}${refDateStr}${colors.reset} (UTC: ${refDate.toISOString()})`);
    }
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
    const firstCompany = await prisma.company.findFirst();
    let employee = oldEmp;
    if (!employee) {
        employee = await prisma.employee.create({
            data: {
                firstName: config.employee.firstName,
                lastName: config.employee.lastName,
                role: 'USER',
                employmentStatus: 'ACTIVE',
                companyId: firstCompany?.id ?? null,
                updatedAt: new Date()
            }
        });
    } else if (firstCompany && !employee.companyId) {
        employee = await prisma.employee.update({
            where: { id: employee.id },
            data: { companyId: firstCompany.id }
        });
    }

    // 4. Create Shifts & Assignments
    const dbShifts: any[] = [];
    let dbHoliday: any = null;
    let primaryShiftId: number | null = null;

    for (const s of config.shifts) {
        const createdShift = await prisma.shift.create({
            data: {
                shiftCode: s.shiftCode,
                name: s.name,
                startTime: s.startTime,
                endTime: s.endTime,
                graceMinutes: s.graceMinutes,
                breakMinutes: s.breakMinutes !== undefined ? s.breakMinutes : 0,
                breaks: s.breaks ? (typeof s.breaks === 'string' ? s.breaks : JSON.stringify(s.breaks)) : '[]',
                isActive: true,
                workDays: JSON.stringify(s.workDays),
                halfDays: s.halfDays ? JSON.stringify(s.halfDays) : '[]',
                halfDayHours: s.halfDayHours !== undefined ? s.halfDayHours : null,
                isNightShift: !!s.isNightShift
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

    // Clear pre-existing holiday on dateOnly
    await prisma.holiday.deleteMany({ where: { date: dateOnly } });

    // Create Holiday if configured
    if (config.holiday) {
        const rawType = (config.holiday.type || '').toUpperCase();
        const validTypes = ['REGULAR', 'SPECIAL'];
        const holidayType = validTypes.includes(rawType) ? rawType : 'REGULAR';

        dbHoliday = await prisma.holiday.create({
            data: {
                name: config.holiday.name || 'Simulated Holiday',
                date: dateOnly,
                type: holidayType as any
            }
        });
        console.log(`Created Holiday: ${colors.green}${dbHoliday.name}${colors.reset}`);
    }

    // 5. Create Approved Overtime requests
    for (const ot of config.overtimes) {
        if (!ot.startTime || !ot.endTime) {
            console.log(`${colors.yellow}⚠️  Skipping OT Request: startTime or endTime is null/missing in config.${colors.reset}`);
            continue;
        }
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
    // Auto-infer punch type if missing
    for (let i = 0; i < sortedPunches.length; i++) {
        if (!sortedPunches[i].type) {
            sortedPunches[i].type = i % 2 === 0 ? 'IN' : 'OUT';
        }
    }

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
        where: { employeeId: employee.id },
        include: { shift: true },
        orderBy: { date: 'asc' }
    });

    console.log(`\n${colors.bright}${colors.cyan}=== SIMULATION RESULTS ===${colors.reset}`);
    console.log(`Total Attendance Records Created: ${colors.yellow}${finalAttendance.length}${colors.reset}`);

    if (finalAttendance.length === 0) {
        console.log(`${colors.red}No attendance records were created.${colors.reset}`);
    } else {
        finalAttendance.forEach((att, index) => {
            console.log(`\nRecord #${index + 1}:`);
            console.log(`--------------------------------------------------`);
            const displayCode = att.shift 
                ? att.shift.shiftCode 
                : ((att.overtimeMinutes ?? 0) > 0 ? 'NO_SHIFT_OT' : 'NO_SHIFT');
            const displayName = att.shift 
                ? att.shift.name 
                : ((att.overtimeMinutes ?? 0) > 0 ? 'No Shift (Approved Overtime)' : 'No Shift');

            console.log(`Shift Code:       ${colors.green}${displayCode}${colors.reset}`);
            console.log(`Shift Name:       ${displayName}`);
            console.log(`Check-In Time:    ${colors.cyan}${formatToLocalISO(att.checkInTime)}${colors.reset}`);
            console.log(`Check-Out Time:   ${att.checkOutTime ? colors.cyan + formatToLocalISO(att.checkOutTime) + colors.reset : colors.red + 'N/A (Open Record)' + colors.reset}`);
            let isHalfDay = false;
            if (att.shift) {
                let halfDaysList: string[] = [];
                try { halfDaysList = JSON.parse(att.shift.halfDays || '[]'); } catch { }
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const phtDate = new Date(new Date(att.date).getTime() + 8 * 60 * 60 * 1000);
                const dayName = dayNames[phtDate.getUTCDay()];
                isHalfDay = halfDaysList.includes(dayName);
            }

            // Calculate break details for display
            let breakMinutes = 0;
            let breakDeducted = 0;
            let breakDetailsStr = 'None';
            if (att.shift && !isHalfDay) {
                const currentShift = att.shift;
                breakMinutes = currentShift.breakMinutes ?? 0;
                
                // Parse breaks
                let explicitBreaks: { start: Date, end: Date }[] = [];
                const dateMs = new Date(att.date).getTime() + 8 * 60 * 60 * 1000;
                const [startH, startM] = currentShift.startTime.split(':').map(Number);
                const expectedStart = new Date(dateMs + (startH * 60 + startM) * 60 * 1000 - 8 * 60 * 60 * 1000);
                const [endH, endM] = currentShift.endTime.split(':').map(Number);
                let expectedEnd = new Date(dateMs + (endH * 60 + endM) * 60 * 1000 - 8 * 60 * 60 * 1000);
                if (currentShift.isNightShift && expectedEnd.getTime() <= expectedStart.getTime()) {
                    expectedEnd = new Date(expectedEnd.getTime() + 24 * 60 * 60 * 1000);
                } else if (expectedEnd.getTime() <= expectedStart.getTime()) {
                    expectedEnd = new Date(expectedEnd.getTime() + 24 * 60 * 60 * 1000);
                }

                try {
                    const parsedBreaks = JSON.parse(currentShift.breaks || '[]');
                    explicitBreaks = parsedBreaks.map((b: { start: string; end: string }) => {
                        const [bhStart, bmStart] = b.start.split(':').map(Number);
                        const [bhEnd, bmEnd] = b.end.split(':').map(Number);
                        
                        let bStart = new Date(dateMs + (bhStart * 60 + bmStart) * 60 * 1000 - 8 * 60 * 60 * 1000);
                        let bEnd = new Date(dateMs + (bhEnd * 60 + bmEnd) * 60 * 1000 - 8 * 60 * 60 * 1000);
                        
                        if (currentShift.isNightShift && bhStart < startH) bStart = new Date(bStart.getTime() + 24 * 60 * 60 * 1000);
                        if (currentShift.isNightShift && bhEnd < startH) bEnd = new Date(bEnd.getTime() + 24 * 60 * 60 * 1000);

                        return { start: bStart, end: bEnd };
                    });
                } catch (e) { }

                let effectiveBreaks = explicitBreaks;
                if (explicitBreaks.length === 0 && breakMinutes > 0) {
                    const shiftMidMs = expectedStart.getTime() + (expectedEnd.getTime() - expectedStart.getTime()) / 2;
                    const halfBreakMs = (breakMinutes / 2) * 60 * 1000;
                    effectiveBreaks = [{ start: new Date(shiftMidMs - halfBreakMs), end: new Date(shiftMidMs + halfBreakMs) }];
                    breakDetailsStr = `${breakMinutes} mins (mid-shift auto-break)`;
                } else if (explicitBreaks.length > 0) {
                    const breakRanges = explicitBreaks.map(b => {
                        const startStr = new Date(b.start.getTime() + 8 * 60 * 60 * 1000).toISOString().substr(11, 5);
                        const endStr = new Date(b.end.getTime() + 8 * 60 * 60 * 1000).toISOString().substr(11, 5);
                        return `${startStr}-${endStr}`;
                    }).join(', ');
                    breakDetailsStr = `Explicit breaks: ${breakRanges}`;
                }

                if (att.checkOutTime) {
                    const lateMins = att.lateMinutes ?? 0;
                    const effectiveCheckIn = new Date(expectedStart.getTime() + lateMins * 60 * 1000);
                    const effectiveCheckOut = new Date(Math.min(att.checkOutTime.getTime(), expectedEnd.getTime()));
                    
                    effectiveBreaks.forEach(b => {
                        const overlapStart = Math.max(effectiveCheckIn.getTime(), b.start.getTime());
                        const overlapEnd = Math.min(effectiveCheckOut.getTime(), b.end.getTime());
                        if (overlapEnd > overlapStart) {
                            breakDeducted += (overlapEnd - overlapStart) / 60000;
                        }
                    });
                }
            }

            console.log(`Status:           ${colors.bright}${att.status === 'present' ? colors.green : colors.yellow}${att.status}${colors.reset}`);
            console.log(`Half-Day:         ${isHalfDay ? colors.yellow + 'Yes' + (att.shift?.halfDayHours ? ` (${att.shift.halfDayHours} hrs)` : ' (Midpoint)') : colors.green + 'No'}${colors.reset}`);
            console.log(`Late Minutes:     ${att.lateMinutes > 0 ? colors.red + att.lateMinutes + ' mins' : colors.green + '0 mins'}${colors.reset}`);
            console.log(`Undertime Mins:   ${att.undertimeMinutes > 0 ? colors.red + att.undertimeMinutes + ' mins' : colors.green + '0 mins'}${colors.reset}`);
            console.log(`Overtime Mins:    ${att.overtimeMinutes > 0 ? colors.green + att.overtimeMinutes + ' mins' : '0 mins'}`);
            console.log(`Break Config:     ${colors.cyan}${breakDetailsStr}${colors.reset}`);
            console.log(`Break Deducted:   ${breakDeducted > 0 ? colors.yellow + breakDeducted + ' mins' : colors.green + '0 mins'}${colors.reset}`);
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
        if (dbHoliday) {
            await prisma.holiday.delete({ where: { id: dbHoliday.id } });
            console.log(`Deleted Holiday: ${dbHoliday.name}`);
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
