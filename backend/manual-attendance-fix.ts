import { prisma } from './src/lib/prisma';
import { repairMissingCheckouts } from './src/services/attendance.service';

async function runManualFix() {
    console.log('--- Manual Attendance Fix Started ---');
    try {
        const count = await repairMissingCheckouts();
        console.log(`--- Manual Attendance Fix Completed ---`);
        console.log(`Total records repaired: ${count}`);
    } catch (error) {
        console.error('Error during manual fix:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runManualFix();
