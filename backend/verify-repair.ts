import { prisma } from './src/lib/prisma';
import { repairMissingCheckouts } from './src/services/attendance.service';

async function verifyRepair() {
    console.log('--- Verification: Auto-Checkout Repair ---');

    // 1. Create a "broken" record from yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    console.log(`Checking for record on ${yesterday.toISOString().split('T')[0]}...`);

    // Find a valid employee to use
    const employee = await prisma.employee.findFirst();
    if (!employee) {
        console.error('No employees found to test with.');
        return;
    }

    // Try to find if a record already exists, if not create one
    let record = await prisma.attendance.findUnique({
        where: {
            employeeId_date: {
                employeeId: employee.id,
                date: yesterday
            }
        }
    });

    if (!record) {
        console.log('Creating a test record with missing checkout...');
        const checkIn = new Date(yesterday);
        checkIn.setHours(8, 0, 0, 0);

        record = await prisma.attendance.create({
            data: {
                employeeId: employee.id,
                date: yesterday,
                checkInTime: checkIn,
                status: 'present',
                notes: 'TEST RECORD - MISSING CHECKOUT'
            }
        });
    } else if (record.checkOutTime) {
        console.log('Test record already has checkout. Clearing it for test...');
        await prisma.attendance.update({
            where: { id: record.id },
            data: { checkOutTime: null, notes: 'TEST RECORD - CLEARED FOR REPAIR TEST' }
        });
    }

    console.log('Record is ready (Missing Checkout). Running repair...');

    // 2. Run the repair
    const count = await repairMissingCheckouts();
    console.log(`Repair finished. Count: ${count}`);

    // 3. Verify the result
    const updatedRecord = await prisma.attendance.findUnique({
        where: { id: record.id }
    });

    if (updatedRecord?.checkOutTime) {
        console.log('SUCCESS: Checkout time was set!');
        console.log(`New Checkout: ${updatedRecord.checkOutTime}`);
        console.log(`Notes: ${updatedRecord.notes}`);
    } else {
        console.error('FAILED: Checkout time is still missing.');
    }

    await prisma.$disconnect();
}

verifyRepair();
