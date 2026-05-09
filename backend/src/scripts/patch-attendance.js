const fs = require('fs');
const path = require('path');
const file = path.join('c:/bits/backend/src/modules/attendance/attendance.service.ts');
let content = fs.readFileSync(file, 'utf8');

const resolveFunc = `
export async function resolveShiftForTimestamp(
    employeeId: number,
    timestamp: Date,
    dateOnly: Date
): Promise<{ shift: any | null; isNewCheckin: boolean }> {
    const assignments = await prisma.employeeShift.findMany({
        where: { employeeId },
        include: { shift: true },
        orderBy: { sortOrder: 'asc' }
    });

    if (assignments.length === 0) {
        return { shift: null, isNewCheckin: true };
    }

    const records = await prisma.attendance.findMany({
        where: { employeeId, date: dateOnly },
        select: { shiftId: true, checkOutTime: true }
    });

    const recordMap = new Map(records.map(r => [r.shiftId, r]));
    const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
    const bufferMins = syncConfig?.shiftBufferMinutes ?? 120;
    const bufferMs = bufferMins * 60 * 1000;

    let bestMatch = null;
    let isNewCheckin = true;
    let minDistance = Infinity;

    for (const { shift } of assignments) {
        const [startH, startM] = shift.startTime.split(':').map(Number);
        const [endH, endM] = shift.endTime.split(':').map(Number);

        const shiftStart = new Date(dateOnly);
        shiftStart.setUTCHours(startH - 8, startM, 0, 0);

        const shiftEnd = new Date(dateOnly);
        shiftEnd.setUTCHours(endH - 8, endM, 0, 0);

        if (shiftEnd <= shiftStart) {
            shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);
        }

        const windowStart = new Date(shiftStart.getTime() - bufferMs);
        const windowEnd = new Date(shiftEnd.getTime() + bufferMs);

        const record = recordMap.get(shift.id);
        const needsCheckIn = !record;
        const needsCheckOut = record && !record.checkOutTime;

        if (timestamp >= windowStart && timestamp <= windowEnd) {
            if (needsCheckIn || needsCheckOut) {
                return { shift, isNewCheckin: needsCheckIn };
            }
        }

        const distStart = Math.abs(timestamp.getTime() - shiftStart.getTime());
        const distEnd = Math.abs(timestamp.getTime() - shiftEnd.getTime());
        const minDist = Math.min(distStart, distEnd);

        if (minDist < minDistance) {
            minDistance = minDist;
            bestMatch = shift;
            isNewCheckin = needsCheckIn;
        }
    }

    return { shift: bestMatch, isNewCheckin };
}
`;

content = content.replace('export const processAttendanceLogs = async (): Promise<ProcessResult> => {', resolveFunc + '\nexport const processAttendanceLogs = async (): Promise<ProcessResult> => {');

content = content.replace(
    /const existingAttendance = await prisma\.attendance\.findUnique\(\{\s*where: \{\s*employeeId_date: \{\s*employeeId: log\.employeeId,\s*date: dateOnly\s*\}\s*\}\s*\}\);/g,
    `const { shift: resolvedShift, isNewCheckin } = await resolveShiftForTimestamp(log.employeeId, log.timestamp, dateOnly);

            const existingAttendance = await prisma.attendance.findFirst({
                where: {
                    employeeId: log.employeeId,
                    date: dateOnly,
                    shiftId: resolvedShift?.id ?? null
                }
            });`
);

content = content.replace(
    /const empShift = log\.employee\?\.Shift \?\? null;/g,
    `const empShift = resolvedShift ?? log.employee?.Shift ?? null;`
);

content = content.replace(
    /date: dateOnly,\s*checkInTime: log\.timestamp,/g,
    `date: dateOnly,
                            shiftId: resolvedShift?.id ?? null,
                            checkInTime: log.timestamp,`
);

content = content.replace(
    /if \(diffHours < minCheckoutHours\) \{/g,
    `const shiftDurationHours = resolvedShift 
                    ? (() => {
                        const [sH, sM] = resolvedShift.startTime.split(':').map(Number);
                        const [eH, eM] = resolvedShift.endTime.split(':').map(Number);
                        let duration = (eH + eM/60) - (sH + sM/60);
                        if (duration < 0) duration += 24;
                        return duration;
                      })()
                    : null;
                const effectiveMinCheckout = shiftDurationHours ? Math.min(shiftDurationHours / 2, minCheckoutHours) : minCheckoutHours;

                if (diffHours < effectiveMinCheckout) {`
);

fs.writeFileSync(file, content);
console.log('Successfully patched attendance.service.ts phase 2a');
