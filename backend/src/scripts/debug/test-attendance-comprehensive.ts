/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║        COMPREHENSIVE ATTENDANCE SYSTEM INTEGRATION TEST SUITE              ║
 * ║                                                                            ║
 * ║  Tests every critical attendance scenario:                                 ║
 * ║    1.  On-Time Check-In → On-Time Check-Out (Regular)                      ║
 * ║    2.  Late Check-In → On-Time Check-Out                                   ║
 * ║    3.  On-Time Check-In → Early Check-Out (Undertime)                      ║
 * ║    4.  Late Check-In → Early Check-Out (Late + Undertime Combined)         ║
 * ║    5.  Grace Period Applied (within grace, should NOT mark as late)        ║
 * ║    6.  Overtime After Shift (post-shift OT with approved OT request)       ║
 * ║    7.  Rest-Day Overtime (check-in on rest day, approved OT)               ║
 * ║    8.  Multi-Shift Employee (Shift 1 AM, Shift 2 PM, OT on rest day)       ║
 * ║    9.  Incomplete Record (check-in with no check-out)                      ║
 * ║    10. OT Check-In then Regular Shift Check-In same day (no conflict)      ║
 * ║    11. Double-Punch Guard (same employee two rapid scans, deduplicated)    ║
 * ║    12. Night Shift (crosses midnight, late + undertime + OT)               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import { prisma } from '../../shared/lib/prisma';
import { processAttendanceLogs } from '../../modules/attendance/attendance-processor';
import { toPHTDate } from '../../modules/attendance/attendance-utils';

// ── Colours for terminal output ───────────────────────────────────────────────
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

// ── Result tracking ───────────────────────────────────────────────────────────
let totalPassed = 0;
let totalFailed = 0;
const failedTests: string[] = [];

function pass(label: string) {
    totalPassed++;
    console.log(`  ${C.green}✅ PASS${C.reset}  ${label}`);
}
function fail(label: string, detail?: string) {
    totalFailed++;
    failedTests.push(label);
    console.log(`  ${C.red}❌ FAIL${C.reset}  ${label}`);
    if (detail) console.log(`         ${C.red}→ ${detail}${C.reset}`);
}
function info(label: string) {
    console.log(`  ${C.cyan}ℹ${C.reset}  ${label}`);
}
function section(title: string) {
    console.log(`\n${C.bgBlue}${C.bold}${C.white}  ${title.padEnd(76)}  ${C.reset}`);
}
function divider() {
    console.log(`${C.gray}${'─'.repeat(80)}${C.reset}`);
}

// ── Helper: build a PHT timestamp (HH:MM) for a given date ───────────────────
function phtTime(dateOnly: Date, hhmm: string): Date {
    const [h, m] = hhmm.split(':').map(Number);
    // dateOnly is stored as UTC midnight representing PHT midnight (i.e. UTC = PHT - 8h)
    // dateOnly.getTime() is the UTC ms for "00:00 PHT"
    // so adding (h*60+m)*60000 gives the UTC ms for "HH:MM PHT"
    // But the dateOnly offset: toPHTDate stores as local midnight UTC
    // Formula: dateOnly (which is "00:00+08:00" stored as UTC) + hours as ms
    // Since dateOnly = new Date of "YYYY-MM-DDT00:00:00+08:00" expressed in UTC,
    // adding (h*60+m)*60*1000 gives us HH:MM PHT as UTC
    return new Date(dateOnly.getTime() + (h * 60 + m) * 60 * 1000);
}

// ── Helper: show attendance record fields ─────────────────────────────────────
function showRecord(
    att: {
        id: number; shiftId: number | null; checkInTime: Date; checkOutTime: Date | null;
        status: string; lateMinutes: number; undertimeMinutes: number; overtimeMinutes: number;
        totalHours: number; isAnomaly: boolean; isEarlyOut: boolean; gracePeriodApplied: boolean;
    } & { shift?: { shiftCode: string; name: string } | null }
) {
    const toLocal = (d: Date | null) => d ? new Date(d.getTime() + 8*60*60*1000).toISOString().slice(11,19) + ' PHT' : 'N/A';
    info(`ID=${att.id}  Shift=${att.shift?.shiftCode ?? 'OT-Only'}  Status=${C.bold}${att.status}${C.reset}`);
    info(`CheckIn=${toLocal(att.checkInTime)}  CheckOut=${toLocal(att.checkOutTime)}`);
    info(`Late=${att.lateMinutes}min  Undertime=${att.undertimeMinutes}min  OT=${att.overtimeMinutes}min  TotalHours=${att.totalHours}h`);
    info(`GracePeriod=${att.gracePeriodApplied}  EarlyOut=${att.isEarlyOut}  Anomaly=${att.isAnomaly}`);
}

// ── Employee & Shift setup helpers ────────────────────────────────────────────
async function createTestEmployee(suffix: string) {
    return prisma.employee.create({
        data: {
            firstName: 'TestEmp',
            lastName: suffix,
            role: 'USER',
            employmentStatus: 'ACTIVE',
            updatedAt: new Date()
        }
    });
}

async function createShift(code: string, name: string, start: string, end: string, grace: number, workDays: string[], isNight = false) {
    const existing = await prisma.shift.findFirst({ where: { OR: [{ shiftCode: code }, { name }] } });
    if (existing) await prisma.shift.delete({ where: { id: existing.id } });
    return prisma.shift.create({
        data: {
            shiftCode: code,
            name,
            startTime: start,
            endTime: end,
            graceMinutes: grace,
            breakMinutes: 0,
            isActive: true,
            isNightShift: isNight,
            workDays: JSON.stringify(workDays)
        }
    });
}

async function assignShifts(employeeId: number, shiftAssignments: { shiftId: number; sortOrder: number }[]) {
    await prisma.employeeShift.deleteMany({ where: { employeeId } });
    for (const s of shiftAssignments) {
        await prisma.employeeShift.create({
            data: { employeeId, shiftId: s.shiftId, sortOrder: s.sortOrder, isPrimary: s.sortOrder === 1 }
        });
    }
}

async function cleanEmployee(employeeId: number, dates: Date[]) {
    await prisma.attendanceLog.deleteMany({ where: { employeeId } });
    for (const d of dates) {
        await prisma.attendance.deleteMany({ where: { employeeId, date: d } });
        await prisma.overtimeRequest.deleteMany({ where: { employeeId, date: d } });
    }
}

async function destroyEmployee(employeeId: number) {
    await prisma.attendanceLog.deleteMany({ where: { employeeId } });
    await prisma.attendance.deleteMany({ where: { employeeId } });
    await prisma.overtimeRequest.deleteMany({ where: { employeeId } });
    await prisma.employeeShift.deleteMany({ where: { employeeId } });
    await prisma.employee.delete({ where: { id: employeeId } });
}

async function punch(employeeId: number, timestamp: Date, direction: 0 | 1) {
    // direction: 0 = check-in, 1 = check-out
    try {
        await prisma.attendanceLog.create({ data: { employeeId, timestamp, status: direction } });
    } catch {
        // Duplicate timestamp log — silently skip (as device would)
    }
    await processAttendanceLogs();
}

async function getAtt(employeeId: number, dateOnly: Date) {
    return prisma.attendance.findMany({
        where: { employeeId, date: dateOnly },
        include: { shift: true },
        orderBy: { checkInTime: 'asc' }
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═════════════════════════════════════════════════════════════════════════════
async function runAll() {
    console.log(`\n${C.bgBlue}${C.bold}${C.white}  BITS ATTENDANCE SYSTEM — COMPREHENSIVE TEST SUITE${' '.repeat(30)}${C.reset}`);
    console.log(`${C.gray}  Runs all critical time-in / time-out / OT / late / undertime scenarios${C.reset}\n`);

    // All tests use "today" in PHT as reference date
    const TODAY = new Date();
    const DATE_ONLY = toPHTDate(TODAY);
    const toPHT = (d: Date) => new Date(d.getTime() + 8*60*60*1000).toISOString().slice(11,19) + ' PHT';
    info(`Test reference date: ${new Date(DATE_ONLY.getTime() + 8*60*60*1000).toISOString().slice(0,10)} PHT`);

    // ─── Pre-create shared shifts ─────────────────────────────────────────────
    const SHIFT_DAY = await createShift('TSDAY', 'Day Shift (8-17)', '08:00', '17:00', 10, ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']);
    const SHIFT_HALF = await createShift('TSHALF', 'Half Day (8-12)', '08:00', '12:00', 10, ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']);
    const SHIFT_NIGHT = await createShift('TSNIGHT', 'Night Shift (22-06)', '22:00', '06:00', 15, ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], true);
    const SHIFT_AM = await createShift('TSAM', 'AM Shift (8-12)', '08:00', '12:00', 10, ['Mon','Tue','Wed','Thu']);
    const SHIFT_PM = await createShift('TSPM', 'PM Shift (13-17)', '13:00', '17:00', 10, ['Fri','Sat']);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: On-Time Check-In → On-Time Check-Out
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 1: On-Time Check-In → On-Time Check-Out (Regular)');
    divider();
    {
        const emp = await createTestEmployee('T01');
        await assignShifts(emp.id, [{ shiftId: SHIFT_DAY.id, sortOrder: 1 }]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        info(`Employee: ${emp.id} | Shift: ${SHIFT_DAY.name} (${SHIFT_DAY.startTime}-${SHIFT_DAY.endTime})`);
        info(`Punching IN at 08:00 → expected: present, 0 late, 0 undertime`);
        await punch(emp.id, phtTime(DATE_ONLY, '08:00'), 0);
        info(`Punching OUT at 17:00 → expected: 0 OT, 0 undertime, 9h total`);
        await punch(emp.id, phtTime(DATE_ONLY, '17:00'), 1);

        const records = await getAtt(emp.id, DATE_ONLY);
        const att = records[0];
        if (!att) { fail('Record created'); } else {
            pass('Record created');
            showRecord(att);
            att.status === 'present'      ? pass('Status = present') : fail('Status = present', `got ${att.status}`);
            att.lateMinutes === 0         ? pass('Late = 0 min') : fail('Late = 0 min', `got ${att.lateMinutes}`);
            att.undertimeMinutes === 0    ? pass('Undertime = 0 min') : fail('Undertime = 0 min', `got ${att.undertimeMinutes}`);
            att.totalHours >= 9           ? pass('TotalHours >= 9h') : fail('TotalHours >= 9h', `got ${att.totalHours}`);
            att.overtimeMinutes === 0     ? pass('OT = 0 min') : fail('OT = 0 min', `got ${att.overtimeMinutes}`);
            att.gracePeriodApplied === false ? pass('Grace period NOT applied (exact on-time)') : fail('Grace period NOT applied', `got ${att.gracePeriodApplied}`);
        }
        await destroyEmployee(emp.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Late Check-In → On-Time Check-Out
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 2: Late Check-In → On-Time Check-Out');
    divider();
    {
        const emp = await createTestEmployee('T02');
        await assignShifts(emp.id, [{ shiftId: SHIFT_DAY.id, sortOrder: 1 }]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        info(`Shift grace period: ${SHIFT_DAY.graceMinutes} minutes (08:00-08:10 is acceptable)`);
        info(`Punching IN at 08:45 → expected: lateMinutes=35 (45min - 10min grace)`);
        info(`NOTE: status remains 'present' after checkout — lateness is tracked in lateMinutes field`);
        await punch(emp.id, phtTime(DATE_ONLY, '08:45'), 0);
        info(`Punching OUT at 17:00`);
        await punch(emp.id, phtTime(DATE_ONLY, '17:00'), 1);

        const records = await getAtt(emp.id, DATE_ONLY);
        const att = records[0];
        if (!att) { fail('Record created'); } else {
            pass('Record created');
            showRecord(att);
            // After checkout, status is 'present' (lateness is in lateMinutes, not status)
            att.status === 'present'      ? pass('Status = present (lateness stored in lateMinutes, not status field)') : fail('Status = present', `got ${att.status}`);
            att.lateMinutes === 35        ? pass('Late = 35 min') : fail('Late = 35 min', `got ${att.lateMinutes}`);
            att.lateMinutes > 0           ? pass('lateMinutes > 0 (penalty applied)') : fail('lateMinutes > 0', `got ${att.lateMinutes}`);
            att.undertimeMinutes === 0    ? pass('Undertime = 0 min') : fail('Undertime = 0 min', `got ${att.undertimeMinutes}`);
            att.isEarlyOut === false      ? pass('isEarlyOut = false') : fail('isEarlyOut = false', `got ${att.isEarlyOut}`);
        }
        await destroyEmployee(emp.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: On-Time Check-In → Early Check-Out (Undertime)
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 3: On-Time Check-In → Early Check-Out (Undertime)');
    divider();
    {
        const emp = await createTestEmployee('T03');
        await assignShifts(emp.id, [{ shiftId: SHIFT_DAY.id, sortOrder: 1 }]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        info(`Punching IN at 08:00`);
        await punch(emp.id, phtTime(DATE_ONLY, '08:00'), 0);
        info(`Punching OUT at 15:00 → expected: undertimeMinutes=120 (2hrs before end of 17:00 shift)`);
        info(`NOTE: isEarlyOut flag is only set when checkout BEFORE shift start (completely missed). Mid-shift early exit shows in undertimeMinutes.`);
        await punch(emp.id, phtTime(DATE_ONLY, '15:00'), 1);

        const records = await getAtt(emp.id, DATE_ONLY);
        const att = records[0];
        if (!att) { fail('Record created'); } else {
            pass('Record created');
            showRecord(att);
            att.lateMinutes === 0         ? pass('Late = 0 min') : fail('Late = 0 min', `got ${att.lateMinutes}`);
            att.undertimeMinutes === 120  ? pass('Undertime = 120 min') : fail('Undertime = 120 min', `got ${att.undertimeMinutes}`);
            att.undertimeMinutes > 0      ? pass('Undertime > 0 (penalty applied)') : fail('Undertime > 0', `got ${att.undertimeMinutes}`);
            // isEarlyOut is only true when checkOut <= expectedStart (not mid-shift)
            att.isEarlyOut === false      ? pass('isEarlyOut = false (mid-shift early exit, not pre-shift)') : fail('isEarlyOut = false', `got ${att.isEarlyOut}`);
        }
        await destroyEmployee(emp.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Late Check-In → Early Check-Out (Combined)
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 4: Late Check-In + Early Check-Out (Late + Undertime combined)');
    divider();
    {
        const emp = await createTestEmployee('T04');
        await assignShifts(emp.id, [{ shiftId: SHIFT_DAY.id, sortOrder: 1 }]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        info(`Punching IN at 09:00 → lateMinutes=50 (60min late - 10min grace)`);
        await punch(emp.id, phtTime(DATE_ONLY, '09:00'), 0);
        info(`Punching OUT at 15:30 → undertimeMinutes=90 (17:00 - 15:30 = 90min)`);
        await punch(emp.id, phtTime(DATE_ONLY, '15:30'), 1);

        const records = await getAtt(emp.id, DATE_ONLY);
        const att = records[0];
        if (!att) { fail('Record created'); } else {
            pass('Record created');
            showRecord(att);
            // Status is 'present' post-checkout — both late+undertime tracked in their own fields
            att.status === 'present'      ? pass('Status = present (penalties in lateMinutes/undertimeMinutes)') : fail('Status = present', `got ${att.status}`);
            att.lateMinutes === 50        ? pass('Late = 50 min') : fail('Late = 50 min', `got ${att.lateMinutes}`);
            att.undertimeMinutes === 90   ? pass('Undertime = 90 min') : fail('Undertime = 90 min', `got ${att.undertimeMinutes}`);
            att.lateMinutes > 0           ? pass('lateMinutes > 0 (late penalty applied)') : fail('lateMinutes > 0');
            att.undertimeMinutes > 0      ? pass('undertimeMinutes > 0 (undertime penalty applied)') : fail('undertimeMinutes > 0');
        }
        await destroyEmployee(emp.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Grace Period Applied (just inside grace window, no late penalty)
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 5: Grace Period Applied (08:08, within 10-minute grace)');
    divider();
    {
        const emp = await createTestEmployee('T05');
        await assignShifts(emp.id, [{ shiftId: SHIFT_DAY.id, sortOrder: 1 }]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        info(`Punching IN at 08:08 → within 10-minute grace window`);
        info(`Expected: status=present, late=0, gracePeriodApplied=true`);
        await punch(emp.id, phtTime(DATE_ONLY, '08:08'), 0);
        await punch(emp.id, phtTime(DATE_ONLY, '17:00'), 1);

        const records = await getAtt(emp.id, DATE_ONLY);
        const att = records[0];
        if (!att) { fail('Record created'); } else {
            pass('Record created');
            showRecord(att);
            att.lateMinutes === 0           ? pass('Late = 0 min (grace absorbed)') : fail('Late = 0 min', `got ${att.lateMinutes}`);
            att.gracePeriodApplied === true  ? pass('Grace period flag = true') : fail('Grace period flag = true', `got ${att.gracePeriodApplied}`);
            att.status === 'present'         ? pass('Status = present') : fail('Status = present', `got ${att.status}`);
        }
        await destroyEmployee(emp.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Approved Post-Shift Overtime
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 6: Post-Shift Overtime (Shift 8-12, OT 12:00-14:00)');
    divider();
    {
        const emp = await createTestEmployee('T06');
        await assignShifts(emp.id, [{ shiftId: SHIFT_HALF.id, sortOrder: 1 }]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        const otReq = await prisma.overtimeRequest.create({
            data: { employeeId: emp.id, date: DATE_ONLY, startTime: '12:00', endTime: '14:00', reason: 'Test post-shift OT', status: 'APPROVED' }
        });

        info(`Regular shift: 08:00-12:00. Approved OT: 12:00-14:00`);
        info(`Punching IN at 08:00 (regular shift start)`);
        await punch(emp.id, phtTime(DATE_ONLY, '08:00'), 0);
        info(`Punching OUT at 12:00 (end of regular shift)`);
        await punch(emp.id, phtTime(DATE_ONLY, '12:00'), 1);
        info(`Punching IN again at 12:00 (OT start)`);
        await punch(emp.id, phtTime(DATE_ONLY, '12:01'), 0); // 1 min offset to avoid dup log timestamp
        info(`Punching OUT at 14:00 (OT end)`);
        await punch(emp.id, phtTime(DATE_ONLY, '14:00'), 1);

        const records = await getAtt(emp.id, DATE_ONLY);
        const otReqUpdated = await prisma.overtimeRequest.findUnique({ where: { id: otReq.id } });

        info(`Records created: ${records.length}`);
        records.forEach((r, i) => { info(`--- Record ${i+1} ---`); showRecord(r); });

        records.length >= 1           ? pass('At least 1 attendance record created') : fail('At least 1 record created', `got ${records.length}`);
        otReqUpdated?.actualStartTime ? pass('OT actualStartTime stamped') : fail('OT actualStartTime stamped', 'was null');
        otReqUpdated?.actualEndTime   ? pass('OT actualEndTime stamped') : fail('OT actualEndTime stamped', 'was null');

        const otRecord = records.find(r => r.shiftId === SHIFT_HALF.id);
        if (otRecord) {
            otRecord.lateMinutes === 0     ? pass('Regular shift: Late = 0') : fail('Regular shift: Late = 0', `got ${otRecord.lateMinutes}`);
            otRecord.overtimeMinutes > 0   ? pass(`OT minutes > 0 (got ${otRecord.overtimeMinutes})`) : fail('OT minutes > 0', `got ${otRecord.overtimeMinutes}`);
        }
        await destroyEmployee(emp.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Rest-Day OT (employee has shift Mon-Thu, today check-in on rest day with OT)
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 7: Rest-Day OT (Shift Mon-Thu, OT on current day)');
    divider();
    {
        const phtToday = new Date(DATE_ONLY.getTime() + 8*60*60*1000);
        const todayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][phtToday.getUTCDay()];
        const restDayWorkDays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter(d => d !== todayName);

        const SHIFT_RESTDAY = await createShift('TSREST', `RestDay Test (not-${todayName})`, '08:00', '12:00', 10, restDayWorkDays);
        const emp = await createTestEmployee('T07');
        await assignShifts(emp.id, [{ shiftId: SHIFT_RESTDAY.id, sortOrder: 1 }]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        const otReq = await prisma.overtimeRequest.create({
            data: { employeeId: emp.id, date: DATE_ONLY, startTime: '09:00', endTime: '11:00', reason: 'Rest-Day OT', status: 'APPROVED' }
        });

        info(`Today (${todayName}) is a rest day for this employee`);
        info(`Approved OT: 09:00-11:00`);
        info(`Punching IN at 09:00 → expected: OT-Only record (shiftId=null), not rest-day shift`);
        await punch(emp.id, phtTime(DATE_ONLY, '09:00'), 0);
        info(`Punching OUT at 11:00`);
        await punch(emp.id, phtTime(DATE_ONLY, '11:00'), 1);

        const records = await getAtt(emp.id, DATE_ONLY);
        const otReqUpdated = await prisma.overtimeRequest.findUnique({ where: { id: otReq.id } });

        info(`Records created: ${records.length}`);
        records.forEach((r, i) => { info(`--- Record ${i+1} ---`); showRecord(r); });

        records.length === 1                  ? pass('Exactly 1 OT-only record created') : fail('Exactly 1 record', `got ${records.length}`);
        records[0]?.shiftId === null          ? pass('shiftId = null (OT-only)') : fail('shiftId = null', `got ${records[0]?.shiftId}`);
        otReqUpdated?.actualStartTime         ? pass('OT actualStartTime stamped') : fail('OT actualStartTime stamped', 'was null');
        otReqUpdated?.actualEndTime           ? pass('OT actualEndTime stamped') : fail('OT actualEndTime stamped', 'was null');
        records[0]?.lateMinutes === 0         ? pass('No late penalty on rest-day OT') : fail('No late penalty on rest-day OT', `got ${records[0]?.lateMinutes}`);

        await destroyEmployee(emp.id);
        await prisma.shift.delete({ where: { id: SHIFT_RESTDAY.id } });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Multi-Shift + Rest-Day OT (the original reported bug scenario)
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 8: Multi-Shift — Shift 1 (AM Mon-Thu) + Shift 2 (PM Fri-Sat) + OT on today');
    divider();
    {
        const phtToday = new Date(DATE_ONLY.getTime() + 8*60*60*1000);
        const todayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][phtToday.getUTCDay()];

        // Shift 1 is a rest day today, Shift 2 is a work day today
        const shift1WorkDays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter(d => d !== todayName);
        const shift2WorkDays = [todayName]; // only today

        const SH1 = await createShift('TSM1', `Multi-Shift 1 (not-${todayName})`, '08:00', '12:00', 10, shift1WorkDays);
        const SH2 = await createShift('TSM2', `Multi-Shift 2 (${todayName})`, '13:00', '17:00', 10, shift2WorkDays);
        const emp = await createTestEmployee('T08');
        await assignShifts(emp.id, [
            { shiftId: SH1.id, sortOrder: 1 },
            { shiftId: SH2.id, sortOrder: 2 }
        ]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        const otReq = await prisma.overtimeRequest.create({
            data: { employeeId: emp.id, date: DATE_ONLY, startTime: '10:00', endTime: '12:00', reason: 'Rest-day OT during Shift1 hours', status: 'APPROVED' }
        });

        info(`Employee has 2 shifts:`);
        info(`  Shift 1: 08:00-12:00 (rest day today — ${todayName})`);
        info(`  Shift 2: 13:00-17:00 (work day today — ${todayName})`);
        info(`  Approved OT: 10:00-12:00 (during Shift 1's hours, which is a rest day)`);

        info(`Step 1: Punch IN at 10:00 for OT → should NOT be captured by Shift 2`);
        await punch(emp.id, phtTime(DATE_ONLY, '10:00'), 0);

        info(`Step 2: Punch OUT at 12:00 for OT`);
        await punch(emp.id, phtTime(DATE_ONLY, '12:00'), 1);

        info(`Step 3: Punch IN at 13:00 for regular Shift 2`);
        await punch(emp.id, phtTime(DATE_ONLY, '13:00'), 0);

        const records = await getAtt(emp.id, DATE_ONLY);
        const otReqUpdated = await prisma.overtimeRequest.findUnique({ where: { id: otReq.id } });

        info(`\nTotal records: ${records.length}`);
        records.forEach((r, i) => { info(`--- Record ${i+1} ---`); showRecord(r); });

        records.length === 2                  ? pass('Exactly 2 records (OT + Shift 2)') : fail('Exactly 2 records', `got ${records.length}`);

        const otRecord   = records.find(r => r.shiftId === null);
        const sh2Record  = records.find(r => r.shiftId === SH2.id);

        otRecord          ? pass('OT-only record exists (shiftId=null)') : fail('OT-only record exists');
        sh2Record         ? pass('Shift 2 record exists') : fail('Shift 2 record exists');
        otReqUpdated?.actualStartTime ? pass('OT actualStartTime stamped') : fail('OT actualStartTime stamped', 'was null');
        otReqUpdated?.actualEndTime   ? pass('OT actualEndTime stamped') : fail('OT actualEndTime stamped', 'was null');
        if (sh2Record) {
            sh2Record.shiftId === SH2.id ? pass('Shift 2 record has correct shiftId') : fail('Shift 2 shiftId', `got ${sh2Record.shiftId}`);
            sh2Record.lateMinutes === 0  ? pass('Shift 2: on-time (0 late min)') : fail('Shift 2: on-time', `got ${sh2Record.lateMinutes}`);
        }

        await destroyEmployee(emp.id);
        await prisma.shift.delete({ where: { id: SH1.id } });
        await prisma.shift.delete({ where: { id: SH2.id } });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 9: Incomplete Record (Check-In Only, No Check-Out)
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 9: Incomplete Record — Check-In Only (No Check-Out)');
    divider();
    {
        const emp = await createTestEmployee('T09');
        await assignShifts(emp.id, [{ shiftId: SHIFT_DAY.id, sortOrder: 1 }]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        info(`Punching IN at 08:00 only — no check-out`);
        info(`Expected: record status = incomplete or present (depending on end-of-day automation), checkOutTime = null`);
        await punch(emp.id, phtTime(DATE_ONLY, '08:00'), 0);

        const records = await getAtt(emp.id, DATE_ONLY);
        const att = records[0];
        if (!att) { fail('Record created'); } else {
            pass('Record created');
            showRecord(att);
            att.checkOutTime === null     ? pass('checkOutTime = null (no checkout)') : fail('checkOutTime = null', `got ${att.checkOutTime}`);
            const validStatuses = ['present', 'incomplete', 'IN_PROGRESS'];
            validStatuses.includes(att.status) ? pass(`Status is valid open state (${att.status})`) : fail('Status is valid open state', `got ${att.status}`);
        }
        await destroyEmployee(emp.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 10: OT Check-In then Regular Shift Check-In — No Conflict
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 10: OT Check-In then Regular Shift Check-In — No Conflict');
    divider();
    {
        const emp = await createTestEmployee('T10');
        await assignShifts(emp.id, [{ shiftId: SHIFT_DAY.id, sortOrder: 1 }]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        // OT is before the shift (pre-shift OT)
        const otReq = await prisma.overtimeRequest.create({
            data: { employeeId: emp.id, date: DATE_ONLY, startTime: '06:00', endTime: '08:00', reason: 'Pre-shift OT', status: 'APPROVED' }
        });

        info(`Shift: 08:00-17:00. Pre-shift OT: 06:00-08:00`);
        info(`Punch IN at 06:00 (OT)`);
        await punch(emp.id, phtTime(DATE_ONLY, '06:00'), 0);
        info(`Punch OUT at 08:00 (OT done)`);
        await punch(emp.id, phtTime(DATE_ONLY, '08:00'), 1);
        info(`Punch IN at 08:01 (regular shift start)`);
        await punch(emp.id, phtTime(DATE_ONLY, '08:01'), 0);
        info(`Punch OUT at 17:00 (regular shift end)`);
        await punch(emp.id, phtTime(DATE_ONLY, '17:00'), 1);

        const records = await getAtt(emp.id, DATE_ONLY);
        const otReqUpdated = await prisma.overtimeRequest.findUnique({ where: { id: otReq.id } });

        info(`Records: ${records.length}`);
        records.forEach((r, i) => { info(`--- Record ${i+1} ---`); showRecord(r); });

        otReqUpdated?.actualStartTime ? pass('OT actualStartTime stamped') : fail('OT actualStartTime stamped');
        otReqUpdated?.actualEndTime   ? pass('OT actualEndTime stamped') : fail('OT actualEndTime stamped');
        const shiftRecord = records.find(r => r.shiftId === SHIFT_DAY.id);
        shiftRecord ? pass('Regular shift record exists') : fail('Regular shift record exists');
        if (shiftRecord) {
            shiftRecord.lateMinutes === 0 ? pass('Regular shift: not late') : fail('Regular shift: not late', `got ${shiftRecord.lateMinutes}`);
        }
        await destroyEmployee(emp.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 11: Double-Punch Guard (two rapid identical scans)
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 11: Double-Punch Guard — Two rapid identical scans de-duplicated');
    divider();
    {
        const emp = await createTestEmployee('T11');
        await assignShifts(emp.id, [{ shiftId: SHIFT_DAY.id, sortOrder: 1 }]);
        await cleanEmployee(emp.id, [DATE_ONLY]);

        const ts = phtTime(DATE_ONLY, '08:00');
        info(`Punching IN at 08:00 twice (simulating double-tap on device)`);

        // First punch
        await prisma.attendanceLog.create({ data: { employeeId: emp.id, timestamp: ts, status: 0 } });
        await processAttendanceLogs();

        // Second punch at exact same timestamp — should throw unique constraint and be silently caught
        try {
            await prisma.attendanceLog.create({ data: { employeeId: emp.id, timestamp: ts, status: 0 } });
        } catch {
            info(`Second identical punch correctly rejected by DB unique constraint ✔`);
        }
        await processAttendanceLogs();

        const records = await getAtt(emp.id, DATE_ONLY);
        info(`Records: ${records.length}`);
        records.length === 1 ? pass('Exactly 1 attendance record (no duplicate)') : fail('Exactly 1 record', `got ${records.length}`);
        await destroyEmployee(emp.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 12: Night Shift (22:00-06:00 crossing midnight)
    // ─────────────────────────────────────────────────────────────────────────
    section('TEST 12: Night Shift (22:00-06:00 crossing midnight, late check-in + OT)');
    divider();
    {
        const emp = await createTestEmployee('T12');
        await assignShifts(emp.id, [{ shiftId: SHIFT_NIGHT.id, sortOrder: 1 }]);

        // Night shift starts "today" at 22:00 and ends "tomorrow" at 06:00
        // Use today as the date for the record
        await cleanEmployee(emp.id, [DATE_ONLY]);

        const otReq = await prisma.overtimeRequest.create({
            data: { employeeId: emp.id, date: DATE_ONLY, startTime: '06:00', endTime: '07:00', reason: 'Night shift post-shift OT', status: 'APPROVED' }
        });

        info(`Night shift: 22:00-06:00. Late grace: ${SHIFT_NIGHT.graceMinutes}min`);
        info(`Punch IN at 22:30 → late by 15 min (30min - 15min grace = 15min late)`);
        await punch(emp.id, phtTime(DATE_ONLY, '22:30'), 0);
        info(`Punch OUT at 05:00 next morning → undertime = 60min`);
        // 05:00 next day
        const nextDayDate05 = new Date(phtTime(DATE_ONLY, '05:00').getTime() + 24*60*60*1000);
        await punch(emp.id, nextDayDate05, 1);

        const records = await getAtt(emp.id, DATE_ONLY);
        const att = records[0];
        info(`Records: ${records.length}`);
        if (!att) { fail('Night shift record created'); } else {
            pass('Night shift record created');
            showRecord(att);
            att.shiftId === SHIFT_NIGHT.id ? pass('Linked to night shift') : fail('Linked to night shift', `got ${att.shiftId}`);
            att.lateMinutes === 15          ? pass('Late = 15 min') : fail('Late = 15 min', `got ${att.lateMinutes}`);
            att.undertimeMinutes === 60     ? pass('Undertime = 60 min') : fail('Undertime = 60 min', `got ${att.undertimeMinutes}`);
        }

        await destroyEmployee(emp.id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FINAL SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`\n${C.bold}${'═'.repeat(80)}${C.reset}`);
    const totalTests = totalPassed + totalFailed;
    const statusBg = totalFailed === 0 ? C.bgGreen : C.bgRed;
    console.log(`\n${statusBg}${C.bold}${C.white}  FINAL RESULTS: ${totalPassed}/${totalTests} PASSED  ${' '.repeat(55)}${C.reset}`);

    if (totalFailed > 0) {
        console.log(`\n${C.red}${C.bold}  Failed Tests:${C.reset}`);
        failedTests.forEach(t => console.log(`  ${C.red}• ${t}${C.reset}`));
    } else {
        console.log(`\n${C.green}${C.bold}  All ${totalPassed} assertions passed! System is operating correctly.${C.reset}`);
    }
    console.log();

    // ── Cleanup shared shifts ─────────────────────────────────────────────────
    await prisma.shift.deleteMany({ where: { shiftCode: { in: ['TSDAY','TSHALF','TSNIGHT','TSAM','TSPM'] } } });
    console.log(`${C.gray}  Shared test shifts cleaned up.${C.reset}\n`);
}

runAll().catch(e => {
    console.error('\n\n❌ UNCAUGHT ERROR IN TEST SUITE:', e);
    process.exit(1);
});
