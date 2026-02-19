import { syncEmployeesToDevice } from '../services/zkServices';
import { prisma } from '../lib/prisma';

async function main() {
    console.log('Updating Admin badge number...');
    try {
        // 1. Update Admin (zkId: 1) to have employeeNumber '2948876'
        const admin = await prisma.employee.update({
            where: { zkId: 1 },
            data: { employeeNumber: '2948876' }
        });
        console.log('Admin updated:', admin.firstName, admin.employeeNumber);

        // 2. Sync
        console.log('Starting manual sync...');
        const result = await syncEmployeesToDevice();
        console.log('Sync Result:', result);

    } catch (error) {
        console.error('Operation failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
