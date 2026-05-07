import { syncEmployeesToDevice } from '../../modules/devices/zk';
import { prisma } from '../../shared/lib/prisma';

async function main() {
    console.log('Starting manual sync...');
    try {
        const result = await syncEmployeesToDevice();
        console.log('Sync Result:', result);
    } catch (error) {
        console.error('Sync failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();



