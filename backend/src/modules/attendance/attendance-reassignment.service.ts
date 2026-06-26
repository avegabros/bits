import { Prisma } from '@prisma/client';
import { getChronologicalShiftIds } from '../shifts/shift-ordering.service';
import { recalculateAndPersistAttendanceMetrics } from './attendance-processor';

/**
 * Reassigns today's open attendance records for any shifts that were removed
 * from the employee to the newly added shifts using chronological pairing.
 *
 * @param employeeId The ID of the employee
 * @param originalShiftIds The employee's shift IDs before the update
 * @param sortedShiftIds The employee's shift IDs after the update (sorted chronologically)
 * @param tx Prisma transaction client
 */
export async function reassignSameDayShifts(
    employeeId: number,
    originalShiftIds: number[],
    sortedShiftIds: number[],
    tx: Prisma.TransactionClient
): Promise<void> {
    const originalChronologicalShiftIds = await getChronologicalShiftIds(originalShiftIds);
    const removedShiftIds = originalChronologicalShiftIds.filter(id => !sortedShiftIds.includes(id));
    const addedShiftIds = sortedShiftIds.filter(id => !originalChronologicalShiftIds.includes(id));

    if (removedShiftIds.length > 0) {
        const now = new Date();
        const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
        pht.setUTCHours(0, 0, 0, 0);
        const todayPHT = new Date(pht.getTime() - 8 * 60 * 60 * 1000);

        // Fetch today's open attendance records (check-in only) associated with the removed shifts
        const todayAttendancesToReassign = await tx.attendance.findMany({
            where: {
                employeeId,
                date: todayPHT,
                shiftId: { in: removedShiftIds },
                checkOutTime: null
            }
        });

        if (todayAttendancesToReassign.length > 0) {
            for (const att of todayAttendancesToReassign) {
                // Find the index of this old shift in the chronological removed list
                const oldShiftId = att.shiftId;
                const removedIdx = oldShiftId !== null ? removedShiftIds.indexOf(oldShiftId) : -1;

                // Pair it with the added shift at the same index, or default to null
                let targetShiftId: number | null = null;
                if (removedIdx !== -1 && removedIdx < addedShiftIds.length) {
                    targetShiftId = addedShiftIds[removedIdx];
                }

                if (targetShiftId !== null) {
                    const exists = await tx.attendance.findFirst({
                        where: {
                            employeeId,
                            date: todayPHT,
                            shiftId: targetShiftId
                        }
                    });
                    if (exists) {
                        console.warn(`[ShiftReassign] Target Shift ID ${targetShiftId} already has an attendance record today. Falling back to No Shift (null) for record ID ${att.id} to prevent unique constraint violation.`);
                        targetShiftId = null;
                    }
                }

                await tx.attendance.update({
                    where: { id: att.id },
                    data: {
                        shiftId: targetShiftId,
                        updatedAt: new Date()
                    }
                });
            }
            
            // Recalculate metrics for the updated records
            await recalculateAndPersistAttendanceMetrics(employeeId, todayPHT, tx);
        }
    }
}
