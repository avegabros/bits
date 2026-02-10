const { ZKDriver } = require('./dist/lib/zk-driver');

async function checkDeviceLogs() {
    const driver = new ZKDriver(process.env.ZK_HOST || '192.168.1.201', parseInt(process.env.ZK_PORT || '4370'));

    try {
        console.log('Connecting to device...');
        await driver.connect();
        console.log('✅ Connected!\n');

        console.log('Fetching ALL logs from device...');
        const logs = await driver.getLogs();
        console.log(`\n📊 Total logs on device: ${logs.length}\n`);

        logs.forEach((log, idx) => {
            const time = new Date(log.recordTime);
            console.log(`${idx + 1}. User ${log.deviceUserId} - ${time.toISOString()} (${time.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })})`);
        });

        await driver.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkDeviceLogs();
