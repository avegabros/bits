import { ZKDriver } from '../lib/zk-driver';

async function main() {
    const ip = process.env.ZK_HOST || '192.168.1.201';
    const port = parseInt(process.env.ZK_PORT || '4370');
    console.log(`Connecting to ${ip}:${port}...`);

    const zk = new ZKDriver(ip, port);
    try {
        await zk.connect();
        const users = await zk.getUsers();

        console.log(`Found ${users.length} users.`);

        // Find our specific admin user (zkId 1 or badge 2948876)
        const admin = users.find(u => u.uid === 1 || u.userId === '2948876' || u.name === 'Admin');

        if (admin) {
            console.log('--- ADMIN USER FOUND ---');
            console.log(admin);
            console.log('------------------------');
        } else {
            console.log('Admin user NOT found on device.');
        }

        // Print first 5 users for context
        console.log('First 5 users:');
        console.table(users.slice(0, 5));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await zk.disconnect();
    }
}

main();
