import { ZKDriver } from '../../shared/lib/zk-driver';
import * as fs from 'fs';
import * as path from 'path';

interface DeviceData {
    totalUsers: number;
    totalFingerprints: number;
    users: Map<string, { uid: number; name: string; fingerprints: number }>;
}

async function getDeviceData(ip: string): Promise<DeviceData> {
    console.log(`Connecting to ZKTeco device at ${ip}...`);
    const zk = new ZKDriver(ip, 4370);
    const data: DeviceData = {
        totalUsers: 0,
        totalFingerprints: 0,
        users: new Map()
    };

    try {
        await zk.connect();
        const users = await zk.getUsers();
        data.totalUsers = users.length;
        
        console.log(`Device ${ip}: Found ${users.length} users. Checking fingerprints...`);
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            process.stdout.write(`\r[${ip}] checking: ${i + 1}/${users.length} (zkId: ${user.uid})...`);
            
            const fpCount = await zk.getFingerCount(user.uid);
            data.users.set(user.userId, {
                uid: user.uid,
                name: user.name,
                fingerprints: fpCount
            });
            data.totalFingerprints += fpCount;
        }
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        console.log(`Device ${ip}: Complete. Found ${data.totalFingerprints} fingerprints across users.`);
    } catch (err) {
        console.error(`Error on device ${ip}:`, err);
    } finally {
        await zk.disconnect();
    }
    return data;
}

async function main() {
    const dev1Ip = '10.10.0.32';
    const dev2Ip = '10.10.0.30';

    const dev1Data = await getDeviceData(dev1Ip);
    const dev2Data = await getDeviceData(dev2Ip);

    // Get union of all user IDs
    const allUserIds = new Set<string>([
        ...dev1Data.users.keys(),
        ...dev2Data.users.keys()
    ]);

    // Sort user IDs numerically
    const sortedUserIds = Array.from(allUserIds).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    let md = `# ZKTeco Biometric Devices Fingerprint Report\n\n`;
    md += `Report generated on: ${new Date().toLocaleString()}\n\n`;

    md += `## Device Summary\n\n`;
    md += `| Device IP | Total Users | Enrolled Fingerprints |\n`;
    md += `| :--- | :---: | :---: |\n`;
    md += `| **${dev1Ip}** | ${dev1Data.totalUsers} | ${dev1Data.totalFingerprints} |\n`;
    md += `| **${dev2Ip}** | ${dev2Data.totalUsers} | ${dev2Data.totalFingerprints} |\n\n`;

    md += `## Detailed Fingerprint Comparison\n\n`;
    md += `| User ID (zkId) | Name | Fingerprints on **${dev1Ip}** | Fingerprints on **${dev2Ip}** | Status |\n`;
    md += `| :---: | :--- | :---: | :---: | :--- |\n`;

    for (const userId of sortedUserIds) {
        const u1 = dev1Data.users.get(userId);
        const u2 = dev2Data.users.get(userId);

        const name = u1?.name || u2?.name || 'Unknown';
        const fp1 = u1 ? u1.fingerprints : 0;
        const fp2 = u2 ? u2.fingerprints : 0;

        let status = '';
        if (u1 && u2) {
            if (fp1 === fp2) {
                status = fp1 > 0 ? '✅ Matched' : '⚠️ No fingerprints on either';
            } else {
                status = `❌ Mismatch (Diff: ${Math.abs(fp1 - fp2)})`;
            }
        } else if (u1) {
            status = `⚠️ Only on ${dev1Ip}`;
        } else {
            status = `⚠️ Only on ${dev2Ip}`;
        }

        md += `| ${userId} | ${name} | ${fp1} | ${fp2} | ${status} |\n`;
    }

    const outputPath = path.resolve(__dirname, '../../../../device_fingerprints_report.md');
    fs.writeFileSync(outputPath, md, 'utf-8');
    console.log(`\nMarkdown report successfully generated at: ${outputPath}`);
}

main().catch(console.error);
