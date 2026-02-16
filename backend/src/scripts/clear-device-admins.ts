import { ZKDriver } from '../lib/zk-driver';
import { prisma } from '../lib/prisma';

async function main() {
    const ip = process.env.ZK_HOST || '192.168.1.201';
    const port = parseInt(process.env.ZK_PORT || '4370');
    console.log(`Connecting to ${ip}:${port}...`);

    const zk = new ZKDriver(ip, port);
    try {
        await zk.connect();

        console.log('Fetching all users...');
        const users = await zk.getUsers();

        console.log(`Found ${users.length} users. Checking for admins...`);

        const admins = users.filter(u => u.role === 14);
        console.log(`Found ${admins.length} admins.`);

        for (const admin of admins) {
            console.log(`Demoting Admin: ${admin.name} (UID: ${admin.uid}) to User...`);
            // Set role to 0 (User)
            // zkId, name, password, role, cardno, userId
            await zk.setUser(admin.uid, admin.name, admin.password, 0, admin.cardno, admin.userId);
            console.log(`   > Done.`);
        }

        console.log('All admins have been demoted to Standard Users.');
        console.log('You should now be able to access the device menu without verification.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await zk.disconnect();
        await prisma.$disconnect();
    }
}

main();
