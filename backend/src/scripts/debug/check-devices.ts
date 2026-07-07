import { prisma } from '../../shared/lib/prisma';
import { ZKDriver } from '../../shared/lib/zk-driver';

async function main() {
    const devices = await prisma.device.findMany();
    console.log('--- DEVICES IN DATABASE ---');
    console.table(devices.map(d => ({
        id: d.id,
        name: d.name,
        ip: d.ip,
        port: d.port,
        isActive: d.isActive,
        syncEnabled: d.syncEnabled,
        lastSyncStatus: d.lastSyncStatus,
        lastSyncError: d.lastSyncError
    })));

    console.log('\n--- TESTING CONNECTION TO EACH DEVICE ---');
    for (const d of devices) {
        console.log(`Connecting to ${d.name} (${d.ip}:${d.port})...`);
        const zk = new ZKDriver(d.ip, d.port);
        try {
            await zk.connect();
            console.log(`  ✓ Connected to ${d.name} successfully.`);
            await zk.disconnect();
        } catch (err: any) {
            console.log(`  ✗ Failed to connect to ${d.name}: ${err?.message || err}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
