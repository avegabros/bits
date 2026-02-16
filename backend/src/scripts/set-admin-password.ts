import { ZKDriver } from '../lib/zk-driver';

async function main() {
    const ip = process.env.ZK_HOST || '192.168.1.201';
    const port = parseInt(process.env.ZK_PORT || '4370');
    console.log(`Connecting to ${ip}:${port}...`);

    const zk = new ZKDriver(ip, port);
    try {
        await zk.connect();

        // Hardcoded values for Admin
        const zkId = 1;
        const name = 'Admin';
        const role = 14;
        const badgeNumber = '2948876';
        const password = '123'; // Try setting a simple password

        console.log(`Setting Admin with password '123'...`);

        // zkId, name, password, role, cardno, userId
        await zk.setUser(zkId, name, password, role, 0, badgeNumber);

        console.log('Admin updated with password.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await zk.disconnect();
    }
}

main();
