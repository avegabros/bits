import { ZKDriver } from '../../shared/lib/zk-driver';
import { prisma } from '../../shared/lib/prisma';

async function main() {
    const ip = '192.168.0.155';
    const port = 4370;
    const uid = 65;

    console.log(`Connecting to ZKTeco device at ${ip}:${port}...`);
    const zk = new ZKDriver(ip, port);

    try {
        await zk.connect();
        console.log('Connected successfully!');

        for (let finger = 0; finger <= 9; finger++) {
            console.log(`Querying finger slot ${finger}...`);
            const data = await zk.getFingerTemplate(uid, finger);
            if (data) {
                console.log(`  [Slot ${finger}]: FOUND (${data.length} bytes)`);
                // Let's also query the raw template via the underlying parser to inspect headers
                const buf = Buffer.alloc(3);
                buf.writeUInt16LE(uid, 0);
                buf.writeUInt8(finger, 2);

                const { COMMANDS } = require('node-zklib/constants');
                const { createTCPHeader, removeTcpHeader } = require('node-zklib/utils');
                const zkInfo = (zk as any).zkInstance;

                zkInfo.replyId++;
                const header = createTCPHeader(COMMANDS.CMD_USERTEMP_RRQ, zkInfo.sessionId, zkInfo.replyId, buf);
                await zkInfo.socket.write(header);

                // Wait a bit to read raw response from socket
                const rawResponse = await new Promise<Buffer | null>((resolve) => {
                    const handle = (chunk: Buffer) => {
                        zkInfo.socket.removeListener('data', handle);
                        resolve(chunk);
                    };
                    zkInfo.socket.on('data', handle);
                    setTimeout(() => {
                        zkInfo.socket.removeListener('data', handle);
                        resolve(null);
                    }, 1000);
                });

                if (rawResponse) {
                    const result = removeTcpHeader(rawResponse);
                    const rawTemplate = (zk as any).extractRawTemplate(result);
                    if (rawTemplate.length > 6) {
                        const reportedSize = rawTemplate.readUInt16LE(0);
                        const reportedUid = rawTemplate.readUInt16LE(2);
                        const reportedFinger = rawTemplate.readUInt8(4);
                        const reportedFlag = rawTemplate.readUInt8(5);
                        console.log(`    Parsed Header: size=${reportedSize}, uid=${reportedUid}, finger=${reportedFinger}, flag=${reportedFlag}`);
                        console.log(`    First 16 bytes: ${rawTemplate.subarray(0, 16).toString('hex')}`);
                    } else {
                        console.log(`    Raw Template too small: ${rawTemplate.length} bytes`);
                    }
                }
            } else {
                console.log(`  [Slot ${finger}]: NOT FOUND (or returned null)`);
            }
        }

    } catch (err) {
        console.error('Error during inspection:', err);
    } finally {
        await zk.disconnect().catch(() => {});
        console.log('Disconnected.');
    }
}

main();
