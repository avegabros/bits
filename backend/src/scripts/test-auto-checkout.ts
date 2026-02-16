import { autoCheckoutEmployees } from '../services/attendance.service';
import { prisma } from '../lib/prisma';

/**
 * Test script for auto-checkout functionality
 * This script allows you to test the auto-checkout function without waiting until 11:59 PM
 */

async function testAutoCheckout() {
    console.log('====================================');
    console.log('  AUTO-CHECKOUT TEST SCRIPT');
    console.log('====================================\n');

    try {
        // Step 1: Show current attendance records without checkout
        console.log('Step 1: Checking current attendance records without checkout...\n');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const incompleteRecords = await prisma.attendance.findMany({
            where: {
                date: today,
                checkOutTime: null
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

        console.log(`Found ${incompleteRecords.length} employees without checkout:\n`);
        incompleteRecords.forEach((record, index) => {
            console.log(`${index + 1}. ${record.employee.firstName} ${record.employee.lastName} (${record.employee.employeeNumber})`);
            console.log(`   Check-in: ${record.checkInTime}`);
            console.log(`   Check-out: ${record.checkOutTime || 'NOT SET'}`);
            console.log(`   Notes: ${record.notes || 'None'}\n`);
        });

        if (incompleteRecords.length === 0) {
            console.log('⚠️  No employees found without checkout for today.');
            console.log('   To test this function, create some test attendance records first.\n');
            return;
        }

        // Step 2: Run the auto-checkout function
        console.log('\n====================================');
        console.log('Step 2: Running auto-checkout function...\n');

        const count = await autoCheckoutEmployees();

        console.log(`✅ Auto-checkout completed: ${count} employees processed\n`);

        // Step 3: Show updated records
        console.log('====================================');
        console.log('Step 3: Verifying updated records...\n');

        const updatedRecords = await prisma.attendance.findMany({
            where: {
                date: today,
                notes: {
                    contains: 'Auto checkout'
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

        console.log(`Found ${updatedRecords.length} auto-checked-out records:\n`);
        updatedRecords.forEach((record, index) => {
            console.log(`${index + 1}. ${record.employee.firstName} ${record.employee.lastName} (${record.employee.employeeNumber})`);
            console.log(`   Check-in: ${record.checkInTime}`);
            console.log(`   Check-out: ${record.checkOutTime}`);
            console.log(`   Notes: ${record.notes}\n`);
        });

        console.log('====================================');
        console.log('✅ Test completed successfully!');
        console.log('====================================\n');

    } catch (error) {
        console.error('❌ Error during test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testAutoCheckout();
