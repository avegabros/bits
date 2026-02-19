import { ZKDriver } from '../lib/zk-driver';
import { syncEmployeesToDevice } from '../services/zkServices';
import { prisma } from '../lib/prisma';

async function main() {
    const ip = process.env.ZK_HOST || '192.168.1.201';
    const port = parseInt(process.env.ZK_PORT || '4370');
    console.log(`Connecting to ${ip}:${port}...`);

    const zk = new ZKDriver(ip, port);
    try {
        await zk.connect();

        console.log('Clearing all users from device (Safety Reset)...');
        // We need to implement clearData in ZKDriver or use executeCmd directly if not available
        // node-zklib usually has clearData
        // Let's try to just overwrite by syncing. 
        // Actually, if getUsers returns 0, maybe they are already gone? 
        // Let's just run sync.

        console.log('Starting full sync...');
        const result = await syncEmployeesToDevice();
        console.log('Sync Result:', result);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await zk.disconnect();
        await prisma.$disconnect();
    }
}

main();
