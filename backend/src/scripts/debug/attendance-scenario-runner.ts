import { prisma } from '../../shared/lib/prisma';
import { processAttendanceLogs } from '../../modules/attendance/attendance-processor';
import * as fs from 'fs';
import * as path from 'path';

// Define terminal colors
const C = {
    reset:  '\x1b[0m',
    bold:   '\x1b[1m',
    green:  '\x1b[32m',
    red:    '\x1b[31m',
    yellow: '\x1b[33m',
    cyan:   '\x1b[36m',
    gray:   '\x1b[90m',
    magenta:'\x1b[35m',
    white:  '\x1b[37m',
    bgBlue: '\x1b[44m',
    bgRed:  '\x1b[41m',
    bgGreen:'\x1b[42m',
};

// Log helpers
function pass(msg: string) {
    console.log(`  ${C.green}✅ PASS${C.reset}  ${msg}`);
}

function fail(msg: string, detail?: string) {
    console.log(`  ${C.red}❌ FAIL${C.reset}  ${msg}`);
    if (detail) {
        console.log(`         ${C.red}→ ${detail}${C.reset}`);
    }
}

function info(msg: string) {
    console.log(`  ${C.cyan}ℹ${C.reset}  ${msg}`);
}

function section(title: string) {
    console.log(`\n${C.bgBlue}${C.bold}${C.white}  ${title.padEnd(76)}  ${C.reset}`);
}

function divider() {
    console.log(`${C.gray}${'─'.repeat(80)}${C.reset}`);
}

// Convert relative timestamp "Day X HH:MM" to UTC Date relative to reference date in PHT
function parseRelativeTime(referenceDateStr: string, timeStr: string | null): Date | null {
    if (!timeStr) return null;
    if (timeStr.includes('T')) return new Date(timeStr);

    let day = 1;
    let hhmm = timeStr;
    
    const match = timeStr.match(/^Day (\d+)\s+(.+)$/i);
    if (match) {
        day = parseInt(match[1]);
        hhmm = match[2];
    }
    
    const [h, m] = hhmm.split(':').map(Number);
    // referenceDateStr is YYYY-MM-DD
    const dateOnly = new Date(referenceDateStr + 'T00:00:00+08:00');
    const daysOffset = day - 1;
    const timeMs = dateOnly.getTime() + (daysOffset * 24 * 60 + h * 60 + m) * 60 * 1000;
    return new Date(timeMs);
}

// Helper to format Date to PHT HH:MM string for assertion matching
function formatPHTTime(d: Date | null | undefined): string | null {
    if (!d) return null;
    const pht = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    const h = String(pht.getUTCHours()).padStart(2, '0');
    const m = String(pht.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}

interface ScenarioExpectedRecord {
    shiftCode?: string | null;
    status?: string;
    lateMinutes?: number;
    undertimeMinutes?: number;
    overtimeMinutes?: number;
    totalHours?: number;
    isAnomaly?: boolean;
    checkInTime?: string | null;
    checkOutTime?: string | null;
}

interface ScenarioConfig {
    name: string;
    referenceDate: string;
    shifts: any[];
    overtimes?: any[];
    holiday?: { name: string; type: string };
    punches: { timestamp: string; status: number }[];
    expected: {
        records: ScenarioExpectedRecord[];
    };
}

async function runScenario(scenario: ScenarioConfig, index: number): Promise<boolean> {
    section(`SCENARIO ${index + 1}: ${scenario.name}`);
    divider();

    const empLastName = `Sim-${index + 1}`;
    const empFirstName = `TestEmp`;
    const dateOnly = new Date(scenario.referenceDate + 'T00:00:00+08:00');

    // 1. Database Cleanup for this scenario
    info(`Cleaning old test data...`);
    const oldEmp = await prisma.employee.findFirst({
        where: { firstName: empFirstName, lastName: empLastName }
    });

    if (oldEmp) {
        await prisma.attendanceLog.deleteMany({ where: { employeeId: oldEmp.id } });
        await prisma.attendance.deleteMany({ where: { employeeId: oldEmp.id } });
        await prisma.overtimeRequest.deleteMany({ where: { employeeId: oldEmp.id } });
        await prisma.employeeShift.deleteMany({ where: { employeeId: oldEmp.id } });
    }

    for (const s of scenario.shifts) {
        const existingShift = await prisma.shift.findFirst({ where: { shiftCode: s.shiftCode } });
        if (existingShift) {
            await prisma.employeeShift.deleteMany({ where: { shiftId: existingShift.id } });
            await prisma.attendance.deleteMany({ where: { shiftId: existingShift.id } });
            await prisma.shift.delete({ where: { id: existingShift.id } });
        }
    }
    await prisma.holiday.deleteMany({ where: { date: dateOnly } });

    // 2. Create Employee
    const firstCompany = await prisma.company.findFirst();
    const employee = await prisma.employee.create({
        data: {
            firstName: empFirstName,
            lastName: empLastName,
            role: 'USER',
            employmentStatus: 'ACTIVE',
            companyId: firstCompany?.id ?? null,
            updatedAt: new Date()
        }
    });

    // 3. Create Shifts & Assignments
    let primaryShiftId: number | null = null;
    const createdShifts: any[] = [];
    
    for (const s of scenario.shifts) {
        const createdShift = await prisma.shift.create({
            data: {
                shiftCode: s.shiftCode,
                name: s.name,
                startTime: s.startTime,
                endTime: s.endTime,
                graceMinutes: s.graceMinutes,
                breakMinutes: s.breakMinutes ?? 0,
                breaks: s.breaks ? (typeof s.breaks === 'string' ? s.breaks : JSON.stringify(s.breaks)) : '[]',
                isActive: true,
                workDays: JSON.stringify(s.workDays),
                halfDays: JSON.stringify(s.halfDays ?? []),
                halfDayHours: s.halfDayHours ?? null,
                isNightShift: !!s.isNightShift
            }
        });
        createdShifts.push(createdShift);

        await prisma.employeeShift.create({
            data: {
                employeeId: employee.id,
                shiftId: createdShift.id,
                sortOrder: s.sortOrder,
                isPrimary: !!s.isPrimary
            }
        });

        if (s.isPrimary) {
            primaryShiftId = createdShift.id;
        }
    }

    if (primaryShiftId) {
        await prisma.employee.update({
            where: { id: employee.id },
            data: { shiftId: primaryShiftId }
        });
    }

    // 4. Create Holiday if defined
    let dbHoliday: any = null;
    if (scenario.holiday) {
        dbHoliday = await prisma.holiday.create({
            data: {
                name: scenario.holiday.name,
                date: dateOnly,
                type: (scenario.holiday.type || 'REGULAR').toUpperCase() as any
            }
        });
        info(`Created Holiday: ${scenario.holiday.name}`);
    }

    // 5. Create Overtime Requests
    if (scenario.overtimes) {
        for (const ot of scenario.overtimes) {
            await prisma.overtimeRequest.create({
                data: {
                    employeeId: employee.id,
                    date: dateOnly,
                    startTime: ot.startTime,
                    endTime: ot.endTime,
                    reason: ot.reason || "Simulated OT",
                    status: (ot.status || 'APPROVED').toUpperCase() as any
                }
            });
        }
    }

    // 6. Simulate Punches
    info(`Simulating ${scenario.punches.length} punches...`);
    const sortedPunches = [...scenario.punches].sort((a, b) => {
        const timeA = parseRelativeTime(scenario.referenceDate, a.timestamp)!.getTime();
        const timeB = parseRelativeTime(scenario.referenceDate, b.timestamp)!.getTime();
        return timeA - timeB;
    });

    for (const p of sortedPunches) {
        const punchTime = parseRelativeTime(scenario.referenceDate, p.timestamp)!;
        info(`-> Punch [${p.status === 0 || p.status === 4 ? 'IN' : 'OUT'}] at ${formatPHTTime(punchTime)} PHT`);
        await prisma.attendanceLog.create({
            data: {
                employeeId: employee.id,
                timestamp: punchTime,
                status: p.status
            }
        });
        await processAttendanceLogs();
    }

    // 7. Retrieve resulting records & Assert
    const records = await prisma.attendance.findMany({
        where: { employeeId: employee.id },
        include: { shift: true },
        orderBy: { date: 'asc' }
    });

    let scenarioPassed = true;
    const expectedCount = scenario.expected.records.length;

    if (records.length !== expectedCount) {
        fail(`Records count matching`, `Expected: ${expectedCount}, Got: ${records.length}`);
        scenarioPassed = false;
    } else {
        pass(`Records count matches expected (${expectedCount})`);
    }

    for (let i = 0; i < expectedCount; i++) {
        const expected = scenario.expected.records[i];
        const actual = records[i];

        if (!actual) {
            fail(`Expected record #${i + 1} exists`);
            scenarioPassed = false;
            continue;
        }

        console.log(`\n  Comparing Record #${i + 1}:`);
        const showDiff = (field: string, exp: any, act: any) => {
            if (exp !== act) {
                fail(`${field} check`, `Expected: ${exp}, Got: ${act}`);
                scenarioPassed = false;
            } else {
                pass(`${field} is ${exp}`);
            }
        };

        const actualShiftCode = actual.shift?.shiftCode ?? null;
        showDiff('Shift Code', expected.shiftCode, actualShiftCode);
        showDiff('Status', expected.status, actual.status);

        if (expected.lateMinutes !== undefined) {
            showDiff('Late Minutes', expected.lateMinutes, actual.lateMinutes);
        }
        if (expected.undertimeMinutes !== undefined) {
            showDiff('Undertime Minutes', expected.undertimeMinutes, actual.undertimeMinutes);
        }
        if (expected.overtimeMinutes !== undefined) {
            showDiff('Overtime Minutes', expected.overtimeMinutes, actual.overtimeMinutes);
        }
        if (expected.totalHours !== undefined) {
            showDiff('Total Hours', expected.totalHours, actual.totalHours);
        }
        if (expected.isAnomaly !== undefined) {
            showDiff('Anomaly Flag', expected.isAnomaly, actual.isAnomaly);
        }

        // Check-in and Check-out string comparison in PHT
        const actualCheckInStr = formatPHTTime(actual.checkInTime);
        const actualCheckOutStr = formatPHTTime(actual.checkOutTime);

        if (expected.checkInTime !== undefined) {
            showDiff('Check-In Time', expected.checkInTime, actualCheckInStr);
        }
        if (expected.checkOutTime !== undefined) {
            showDiff('Check-Out Time', expected.checkOutTime, actualCheckOutStr);
        }
    }

    // 8. Cleanup scenario database records
    info(`Cleaning up database...`);
    await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id } });
    await prisma.overtimeRequest.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employeeShift.deleteMany({ where: { employeeId: employee.id } });
    await prisma.employee.delete({ where: { id: employee.id } });

    for (const s of createdShifts) {
        await prisma.shift.delete({ where: { id: s.id } });
    }
    if (dbHoliday) {
        await prisma.holiday.delete({ where: { id: dbHoliday.id } });
    }

    return scenarioPassed;
}

async function main() {
    const configPath = process.argv[2] || 'scenarios-config.json';
    const absolutePath = path.resolve(process.cwd(), configPath);

    if (!fs.existsSync(absolutePath)) {
        console.error(`${C.red}Error: Scenarios config file not found at ${absolutePath}${C.reset}`);
        process.exit(1);
    }

    const configContent = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
    const scenarios: ScenarioConfig[] = configContent.scenarios || [];

    console.log(`\n${C.bgBlue}${C.bold}${C.white}  BITS CUSTOMIZABLE ATTENDANCE SCENARIO RUNNER  ${C.reset}`);
    console.log(`${C.gray}  Running ${scenarios.length} scenarios from ${configPath}${C.reset}\n`);

    let passedCount = 0;
    let failedCount = 0;
    const failures: string[] = [];

    for (let i = 0; i < scenarios.length; i++) {
        const success = await runScenario(scenarios[i], i);
        if (success) {
            passedCount++;
        } else {
            failedCount++;
            failures.push(scenarios[i].name);
        }
    }

    console.log(`\n${C.bold}=== RUN SUMMARY ===${C.reset}`);
    console.log(`Total Scenarios: ${scenarios.length}`);
    console.log(`${C.green}Passed:          ${passedCount}${C.reset}`);
    console.log(`${C.red}Failed:          ${failedCount}${C.reset}`);

    if (failedCount > 0) {
        console.log(`\n${C.red}Failed Scenarios:${C.reset}`);
        failures.forEach(f => console.log(` - ${C.red}${f}${C.reset}`));
        process.exit(1);
    } else {
        console.log(`\n${C.green}All scenarios passed successfully!${C.reset}\n`);
    }
}

main().catch(err => {
    console.error(`\n${C.red}Fatal Runner Error:${C.reset}`, err);
    process.exit(1);
});
