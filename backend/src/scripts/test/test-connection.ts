import { testDeviceConnection } from '../../modules/devices/zk';
import { prisma } from '../../shared/lib/prisma';

/**
 * Test connection to ZKTeco device using node-zklib
 */

async function main() {
    console.log('='.repeat(60));
    console.log('🔌 TESTING ZKTECO DEVICE CONNECTION (node-zklib)');
    console.log('='.repeat(60));

    try {
        const result = await testDeviceConnection();

        console.log('\n' + '='.repeat(60));
        if (result.success) {
            console.log('✅ CONNECTION SUCCESSFUL!');
            console.log(result.message);
        } else {
            console.log('❌ CONNECTION FAILED');
            console.log('Error:', result.error);
        }
        console.log('='.repeat(60) + '\n');

        if (result.success) {
            console.log('🎉 Great! The device is responding.');
            console.log('💡 You can now run the employee sync:');
            console.log('   npm run sync-employees\n');
        } else {
            console.log('⚠️  Please check:');
            console.log('   1. Device is powered on');
            console.log('   2. TCP/IP communication is enabled on device');
            console.log('   3. IP address is correct (192.168.1.196)');
            console.log('   4. Port is correct (4370)');
            console.log('   5. No other software is connected to device\n');
        }

    } catch (error: unknown) {
        console.error('\n❌ UNEXPECTED ERROR:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error) console.error('\nStack trace:', error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();


