import { prisma } from '../lib/prisma';

/**
 * Retroactive auto-checkout test script
 * This will apply auto-checkout logic to specific employees for past dates
 */

async function retroactiveAutoCheckout() {
    console.log('====================================');
    console.log('  RETROACTIVE AUTO-CHECKOUT TEST');
    console.log('====================================\n');

    try {
        const employeeIds = [35, 32];
        const dates = [
            new Date('2026-02-10T00:00:00Z'),
            new Date('2026-02-11T00:00:00Z')
        ];

        console.log(`Target Employees: ${employeeIds.join(', ')}`);
        console.log(`Target Dates: Feb 10, Feb 11\n`);

        // Step 1: Show current status
        console.log('Step 1: Current status of attendance records\n');

        for (const date of dates) {
            const dateStr = date.toISOString().split('T')[0];
            console.log(`--- ${dateStr} ---`);

            for (const empId of employeeIds) {
                const record = await prisma.attendance.findUnique({
                    where: {
                        employeeId_date: {
                            employeeId: empId,
                            date: date
                        }
                    },
                    include: {
                        employee: {
                            select: {
                                firstName: true,
                                lastName: true,
                                employeeNumber: true
                            }
                        }
                    }
                });

                if (record) {
                    console.log(`Employee ${empId} (${record.employee.firstName} ${record.employee.lastName}):`);
                    console.log(`  Check-in:  ${record.checkInTime}`);
                    console.log(`  Check-out: ${record.checkOutTime || 'NOT SET ❌'}`);
                    console.log(`  Status:    ${record.status}`);
                    console.log(`  Notes:     ${record.notes || 'None'}\n`);
                } else {
                    console.log(`Employee ${empId}: No attendance record found\n`);
                }
            }
        }

        // Step 2: Apply auto-checkout
        console.log('\n====================================');
        console.log('Step 2: Applying auto-checkout logic\n');

        for (const date of dates) {
            const dateStr = date.toISOString().split('T')[0];

            // Create checkout time at 5:00 PM for this date
            const autoCheckoutTime = new Date(date);
            autoCheckoutTime.setHours(17, 0, 0, 0);

            for (const empId of employeeIds) {
                // Update only if checkOutTime is null
                const result = await prisma.attendance.updateMany({
                    where: {
                        employeeId: empId,
                        date: date,
                        checkOutTime: null
                    },
                    data: {
                        checkOutTime: autoCheckoutTime,
                        notes: `Retroactive auto-checkout test - Set to 5:00 PM for ${dateStr}`,
                        updatedAt: new Date()
                    }
                });

                if (result.count > 0) {
                    console.log(`✅ Updated Employee ${empId} for ${dateStr} - Set checkout to 5:00 PM`);
                } else {
                    console.log(`⏭️  Employee ${empId} for ${dateStr} - Already has checkout or no record found`);
                }
            }
        }

        // Step 3: Show final status
        console.log('\n====================================');
        console.log('Step 3: Final status after auto-checkout\n');

        for (const date of dates) {
            const dateStr = date.toISOString().split('T')[0];
            console.log(`--- ${dateStr} ---`);

            for (const empId of employeeIds) {
                const record = await prisma.attendance.findUnique({
                    where: {
                        employeeId_date: {
                            employeeId: empId,
                            date: date
                        }
                    },
                    include: {
                        employee: {
                            select: {
                                firstName: true,
                                lastName: true,
                                employeeNumber: true
                            }
                        }
                    }
                });

                if (record) {
                    console.log(`Employee ${empId} (${record.employee.firstName} ${record.employee.lastName}):`);
                    console.log(`  Check-in:  ${record.checkInTime}`);
                    console.log(`  Check-out: ${record.checkOutTime} ✅`);
                    console.log(`  Status:    ${record.status}`);
                    console.log(`  Notes:     ${record.notes}\n`);
                }
            }
        }

        console.log('====================================');
        console.log('✅ Retroactive auto-checkout test completed!');
        console.log('====================================\n');
        console.log('You can now view these records in Prisma Studio.');
        console.log('Look for the notes field to confirm auto-checkout was applied.\n');

    } catch (error) {
        console.error('❌ Error during retroactive auto-checkout:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
retroactiveAutoCheckout();
