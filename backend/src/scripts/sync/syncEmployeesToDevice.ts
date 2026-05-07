import { syncEmployeesToDevice } from '../../modules/devices/zk';
import { prisma } from '../../shared/lib/prisma';

/**
 * CLI Script: Sync Employees to ZKTeco Device
 * 
 * Usage: npm run sync-employees
 * 
 * This script pushes all active employees with a zkId from Postgres to the ZKTeco device.
 */

async function main() {
    console.log('='.repeat(60));
    console.log('📤 EMPLOYEE SYNC TO ZKTECO DEVICE');
    console.log('='.repeat(60));

    try {
        // First, show what will be synced
        const employees = await prisma.employee.findMany({
            where: {
                zkId: { not: null },
                employmentStatus: 'ACTIVE',
            },
            select: {
                zkId: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
            },
            orderBy: {
                zkId: 'asc',
            }
        });

        if (employees.length === 0) {
            console.log('\n⚠️  No employees found with zkId assigned.');
            console.log('💡 Tip: Make sure employees have a zkId set in the database.\n');
            return;
        }

        console.log(`\n📋 Found ${employees.length} employees to sync:\n`);
        employees.forEach((emp, idx) => {
            const empNum = emp.employeeNumber ? ` (${emp.employeeNumber})` : '';
            const fullName = `${emp.firstName} ${emp.lastName}`;
            console.log(`   ${idx + 1}. ${fullName}${empNum} - zkId: ${emp.zkId}`);
        });

        console.log('\n🔄 Starting sync process...\n');

        // Execute sync
        const result = await syncEmployeesToDevice();

        console.log('\n' + '='.repeat(60));
        if (result.success) {
            console.log('✅ SYNC SUCCESSFUL!');
            console.log(`📊 ${result.count} employees pushed to device.`);
        } else {
            console.log('❌ SYNC FAILED');
        }

        if (result.message) {
            console.log(`\n${result.message}`);
        }
        console.log('='.repeat(60) + '\n');

    } catch (error: unknown) {
        console.error('\n❌ ERROR:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error) console.error('\nStack trace:', error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();


