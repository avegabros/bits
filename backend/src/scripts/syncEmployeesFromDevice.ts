
import { syncEmployeesFromDevice } from '../services/zkServices';
import { prisma } from '../lib/prisma';

/**
 * CLI Script: Sync Employees FROM ZKTeco Device TO Database
 * 
 * Usage: npm run sync-employees-from-device
 */

async function main() {
    console.log('='.repeat(60));
    console.log('📥 SYNC EMPLOYEES: DEVICE -> DATABASE');
    console.log('='.repeat(60));

    try {
        console.log('\n🔄 Starting sync process...\n');

        // Execute sync
        const result = await syncEmployeesFromDevice();

        console.log('\n' + '='.repeat(60));
        if (result.success) {
            console.log('✅ SYNC SUCCESSFUL!');
            console.log(`📊 ${result.message}`);
        } else {
            console.log('❌ SYNC FAILED');
            console.log('Error:', result.error);
        }
        console.log('='.repeat(60) + '\n');

    } catch (error: any) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
