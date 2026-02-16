
import { ZKDriver } from '../lib/zk-driver';
import { deleteUserFromDevice } from '../services/zkServices';

const run = async () => {
    const ip = process.env.ZK_HOST || '192.168.1.201';
    const port = parseInt(process.env.ZK_PORT || '4370');
    const zk = new ZKDriver(ip, port);

    const TEST_ID = 9999;

    try {
        console.log("1. Connecting to device...");
        await zk.connect();

        console.log(`2. Adding test user ${TEST_ID}...`);
        // setUser(uid, name, password, role, cardno, userId)
        await zk.setUser(TEST_ID, "Test Delete", "", 0, 0, String(TEST_ID));
        console.log("   User added.");

        console.log("3. Verifying user exists...");
        let users = await zk.getUsers();
        let found = users.find((u: any) => u.uid === TEST_ID);
        if (found) {
            console.log("   User verified on device.");
        } else {
            console.error("   ERROR: User not found after adding!");
            return;
        }

        console.log("4. Deleting user (using service function)...");
        await zk.disconnect(); // Service manages its own connection

        const result = await deleteUserFromDevice(TEST_ID);
        console.log("   Service Result:", result);

        console.log("5. Verifying user is gone...");
        await zk.connect();
        users = await zk.getUsers();
        found = users.find((u: any) => u.uid === TEST_ID);

        if (!found) {
            console.log("   SUCCESS: User successfully deleted from device!");
        } else {
            console.error("   FAILURE: User still exists on device!");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        if (zk) await zk.disconnect();
    }
};

run();
