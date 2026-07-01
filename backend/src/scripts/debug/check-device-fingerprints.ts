import { ZKDriver } from '../../shared/lib/zk-driver';

async function main() {
    const ip = '10.10.0.30';
    const port = parseInt(process.env.ZK_PORT || '4370');
    console.log(`Connecting to ZKTeco device at ${ip}:${port}...`);

    const zk = new ZKDriver(ip, port);
    try {
        await zk.connect();
        
        console.log('Fetching users from device...');
        const users = await zk.getUsers();
        console.log(`Found ${users.length} users on the device.\n`);

        console.log('Checking fingerprint status for each user (this is read-only)...');
        let totalFingerprints = 0;
        const usersWithFp: any[] = [];

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            
            // Show inline progress
            process.stdout.write(`\rProgress: Checking user ${i + 1}/${users.length} (zkId: ${user.uid})...`);

            // getFingerCount sends read-only query packets (CMD_USERTEMP_RRQ) for slots 0-9
            const fpCount = await zk.getFingerCount(user.uid);
            if (fpCount > 0) {
                totalFingerprints += fpCount;
                usersWithFp.push({
                    uid: user.uid,
                    userId: user.userId,
                    name: user.name,
                    fingerprints: fpCount
                });
            }
        }
        
        // Clear progress line
        process.stdout.write('\r' + ' '.repeat(80) + '\r');

        if (usersWithFp.length > 0) {
            console.log('--- USERS WITH ENROLLED FINGERPRINTS ---');
            console.table(usersWithFp);
            console.log(`\nTotal users with fingerprints: ${usersWithFp.length}`);
            console.log(`Total fingerprint templates found: ${totalFingerprints}`);
        } else {
            console.log('No users with enrolled fingerprints were found on the device.');
        }

    } catch (error) {
        console.error('Error interacting with ZKTeco device:', error);
    } finally {
        await zk.disconnect();
        console.log('Disconnected from device.');
    }
}

main();
