/**
 * backfill-fingerprint-templates.ts
 * 
 * One-time migration script to read all existing fingerprint templates from
 * ZKTeco devices and backfill them into the FingerprintTemplate cloud DB table.
 * 
 * This is needed because the old code never saved templates to the DB — they
 * only existed on the physical devices. With the new centralized DB design,
 * we need to populate the DB with all existing templates.
 * 
 * Usage:
 *   npx ts-node src/scripts/migrations/backfill-fingerprint-templates.ts
 * 
 * Supports both direct TCP devices and agent-routed devices.
 */

import { prisma } from '../../shared/lib/prisma';
import { getDriver, connectWithRetry, zkErrMsg } from '../../modules/devices/zk/zk-connection.service';
import { acquireDeviceLock, releaseDeviceLock } from '../../modules/devices/zk/zk-lock.service';
import { getDeviceRoute } from '../../modules/devices/device-router.service';
import { sendAgentCommand } from '../../modules/devices/agent-gateway.service';
import { parseTemplateData } from '../../modules/devices/zk/zk-fingerprint.service';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface BackfillStats {
    totalEnrollments: number;
    alreadyCached: number;
    successfulReads: number;
    failedReads: number;
    skippedNoZkId: number;
    errors: string[];
}

async function main() {
    console.log('='.repeat(70));
    console.log('  FINGERPRINT TEMPLATE BACKFILL MIGRATION');
    console.log('  Reads templates from devices and saves them to the cloud DB.');
    console.log('='.repeat(70));
    console.log();

    const stats: BackfillStats = {
        totalEnrollments: 0,
        alreadyCached: 0,
        successfulReads: 0,
        failedReads: 0,
        skippedNoZkId: 0,
        errors: [],
    };

    // 1. Gather all enrollment records grouped by employee
    const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
        include: {
            employee: { select: { id: true, firstName: true, lastName: true, zkId: true } },
            device: { select: { id: true, name: true, ip: true, port: true, branchId: true, isActive: true } },
        },
    });

    stats.totalEnrollments = enrollments.length;
    console.log(`Found ${enrollments.length} enrollment record(s) across all employees.\n`);

    if (enrollments.length === 0) {
        console.log('No enrollment records found. Nothing to migrate.');
        return;
    }

    // 2. Check what's already cached in FingerprintTemplate
    const existingTemplates = await prisma.fingerprintTemplate.findMany({
        select: { employeeId: true, fingerIndex: true },
    });
    const cachedSet = new Set(existingTemplates.map(t => `${t.employeeId}-${t.fingerIndex}`));

    // 3. Build a map: employeeId -> { employee, fingers: Map<fingerIndex, deviceIds[]> }
    const employeeMap = new Map<number, {
        employee: typeof enrollments[0]['employee'];
        fingers: Map<number, { deviceId: number; deviceName: string; ip: string; port: number }[]>;
    }>();

    for (const e of enrollments) {
        if (!employeeMap.has(e.employeeId)) {
            employeeMap.set(e.employeeId, { employee: e.employee, fingers: new Map() });
        }
        const entry = employeeMap.get(e.employeeId)!;
        if (!entry.fingers.has(e.fingerIndex)) {
            entry.fingers.set(e.fingerIndex, []);
        }
        entry.fingers.get(e.fingerIndex)!.push({
            deviceId: e.device.id,
            deviceName: e.device.name,
            ip: e.device.ip,
            port: e.device.port,
        });
    }

    console.log(`Processing ${employeeMap.size} employee(s)...\n`);

    // 4. For each employee, for each finger, try to read from one of the enrolled devices
    for (const [employeeId, { employee, fingers }] of employeeMap) {
        if (!employee.zkId) {
            console.log(`  ⏭  Skipping ${employee.firstName} ${employee.lastName} (id=${employeeId}) — no zkId assigned.`);
            stats.skippedNoZkId += fingers.size;
            continue;
        }

        console.log(`  👤 ${employee.firstName} ${employee.lastName} (id=${employeeId}, zkId=${employee.zkId}) — ${fingers.size} finger(s)`);

        for (const [fingerIndex, devices] of fingers) {
            const cacheKey = `${employeeId}-${fingerIndex}`;

            // Skip if already cached
            if (cachedSet.has(cacheKey)) {
                console.log(`     ✓ Finger ${fingerIndex}: already in cloud DB — skipping.`);
                stats.alreadyCached++;
                continue;
            }

            // Try reading from each device that has this finger until one succeeds
            let saved = false;
            for (const dev of devices) {
                try {
                    const route = await getDeviceRoute(dev.deviceId);

                    let templateBuffer: Buffer | null = null;

                    if (route.mode === 'agent') {
                        console.log(`     📡 Finger ${fingerIndex}: reading from "${dev.deviceName}" via Agent (branch ${route.branchId})...`);
                        const res = await sendAgentCommand(route.branchId, {
                            action: 'READ_FINGERPRINT',
                            deviceIp: dev.ip,
                            devicePort: dev.port,
                            zkId: employee.zkId,
                            fingerIndex,
                        });
                        if (res.success && res.data) {
                            templateBuffer = parseTemplateData(res.data);
                        }
                    } else {
                        console.log(`     🔌 Finger ${fingerIndex}: reading from "${dev.deviceName}" via direct TCP (${dev.ip}:${dev.port})...`);
                        await acquireDeviceLock(dev.deviceId);
                        const zk = getDriver(dev.ip, dev.port);
                        try {
                            await connectWithRetry(zk, 1);
                            templateBuffer = await zk.getFingerTemplate(employee.zkId, fingerIndex);
                            await zk.disconnect();
                        } finally {
                            releaseDeviceLock(dev.deviceId);
                        }
                    }

                    if (templateBuffer && templateBuffer.length > 8) {
                        await prisma.fingerprintTemplate.upsert({
                            where: { employeeId_fingerIndex: { employeeId, fingerIndex } },
                            update: { templateData: templateBuffer as any, updatedAt: new Date() },
                            create: { employeeId, fingerIndex, templateData: templateBuffer as any },
                        });
                        console.log(`     ✅ Finger ${fingerIndex}: saved ${templateBuffer.length} bytes to cloud DB.`);
                        stats.successfulReads++;
                        saved = true;
                        break; // Success — no need to try other devices
                    } else {
                        console.log(`     ⚠  Finger ${fingerIndex}: device "${dev.deviceName}" returned empty/invalid template.`);
                    }
                } catch (err: any) {
                    const msg = err.message || String(err);
                    console.log(`     ❌ Finger ${fingerIndex}: failed from "${dev.deviceName}": ${msg}`);
                }
            }

            if (!saved) {
                stats.failedReads++;
                const errMsg = `Employee ${employee.firstName} ${employee.lastName} (id=${employeeId}), finger ${fingerIndex}: could not read from any device.`;
                stats.errors.push(errMsg);
                console.log(`     ❌ Finger ${fingerIndex}: FAILED — could not read from any source device.`);
            }

            // Brief pause between device reads to avoid overwhelming devices
            await sleep(300);
        }
        console.log();
    }

    // 5. Print summary
    console.log('='.repeat(70));
    console.log('  MIGRATION COMPLETE');
    console.log('='.repeat(70));
    console.log(`  Total enrollment records:    ${stats.totalEnrollments}`);
    console.log(`  Already in cloud DB:         ${stats.alreadyCached}`);
    console.log(`  Successfully backfilled:     ${stats.successfulReads}`);
    console.log(`  Failed to read:              ${stats.failedReads}`);
    console.log(`  Skipped (no zkId):           ${stats.skippedNoZkId}`);
    console.log();

    if (stats.errors.length > 0) {
        console.log('  ERRORS:');
        for (const e of stats.errors) {
            console.log(`    • ${e}`);
        }
    } else {
        console.log('  ✅ No errors — all templates backfilled successfully!');
    }
    console.log();
}

main()
    .catch(err => {
        console.error('\n❌ Migration script failed:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
