import { prisma } from '../../../src/shared/lib/prisma';
import { getDriver, connectWithRetry, zkErrMsg } from '../../../src/modules/devices/zk/zk-connection.service';
import { tryAcquireDeviceLock, releaseDeviceLock } from '../../../src/modules/devices/zk/zk-lock.service';
import { getDeviceRoute } from '../../../src/modules/devices/device-router.service';
import { sendAgentCommand } from '../../../src/modules/devices/agent-gateway.service';

async function main() {
    console.log('[Backfill] Starting biometric templates backfill script...');

    // 1. Fetch all fingerprint enrollments that do not have database templates yet
    const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
        include: {
            employee: {
                select: { id: true, zkId: true, firstName: true, lastName: true }
            },
            device: {
                select: { id: true, name: true, ip: true, port: true, isActive: true }
            }
        }
    });

    console.log(`[Backfill] Found ${enrollments.length} enrollment record(s) in DB to evaluate.`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const enrollment of enrollments) {
        const { employeeId, fingerIndex, deviceId, employee, device } = enrollment;

        if (!employee || !employee.zkId) {
            console.warn(`[Backfill] Enrollment ID ${enrollment.employeeId}-${enrollment.fingerIndex} has no valid employee zkId. Skipping.`);
            skippedCount++;
            continue;
        }

        // Check if database already holds this template
        const existing = await prisma.fingerprintTemplate.findUnique({
            where: {
                employeeId_fingerIndex: {
                    employeeId,
                    fingerIndex
                }
            }
        });

        if (existing) {
            console.log(`[Backfill] Template for ${employee.firstName} ${employee.lastName} (finger index ${fingerIndex}) already exists in DB. Skipping.`);
            skippedCount++;
            continue;
        }

        if (!device.isActive) {
            console.warn(`[Backfill] Device "${device.name}" is marked inactive. Skipping template fetch.`);
            skippedCount++;
            continue;
        }

        console.log(`[Backfill] Pulling template for ${employee.firstName} ${employee.lastName} (Finger ${fingerIndex}) from device "${device.name}"...`);

        const route = await getDeviceRoute(deviceId);

        if (route.mode === 'agent') {
            try {
                const res = await sendAgentCommand(route.branchId, {
                    action: 'READ_FINGERPRINT',
                    deviceIp: device.ip,
                    devicePort: device.port,
                    zkId: employee.zkId,
                    fingerIndex
                });

                if (res.success && res.data) {
                    const templateData = Buffer.from(res.data);
                    
                    await prisma.fingerprintTemplate.create({
                        data: {
                            employeeId,
                            fingerIndex,
                            templateData
                        }
                    });

                    console.log(`[Backfill] ✓ Successfully saved template for ${employee.firstName} ${employee.lastName} (Finger ${fingerIndex}) via Agent.`);
                    successCount++;
                } else {
                    console.error(`[Backfill] ✗ Agent failed to read template: ${res.error || 'Empty response'}`);
                    failCount++;
                }
            } catch (err: any) {
                console.error(`[Backfill] ✗ Agent request failed:`, err.message || err);
                failCount++;
            }
        } else {
            // Direct ZK TCP mode
            const lockAcquired = await tryAcquireDeviceLock(deviceId);
            if (!lockAcquired) {
                console.error(`[Backfill] ✗ Device "${device.name}" is locked by another task. Retrying later.`);
                failCount++;
                continue;
            }

            const zk = getDriver(device.ip, device.port);
            try {
                await connectWithRetry(zk, 1);
                const raw = await zk.getFingerTemplate(employee.zkId, fingerIndex);

                if (raw && raw.length > 0) {
                    const templateData = Buffer.alloc(raw.length);
                    raw.copy(templateData);
                    raw.fill(0); // Security wipe of the copy source

                    await prisma.fingerprintTemplate.create({
                        data: {
                            employeeId,
                            fingerIndex,
                            templateData
                        }
                    });

                    console.log(`[Backfill] ✓ Successfully saved template for ${employee.firstName} ${employee.lastName} (Finger ${fingerIndex}) directly.`);
                    successCount++;
                } else {
                    console.error(`[Backfill] ✗ Device reported empty template slot.`);
                    failCount++;
                }
            } catch (err: unknown) {
                console.error(`[Backfill] ✗ Direct connection failed: ${zkErrMsg(err)}`);
                failCount++;
            } finally {
                try { await zk.disconnect(); } catch { /* ignore */ }
                releaseDeviceLock(deviceId);
            }
        }

        // Slight rate limit delay to avoid socket hammering
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n[Backfill] Backfill migration completed.');
    console.log(`[Backfill] Summary: Success: ${successCount}, Failed: ${failCount}, Skipped: ${skippedCount}`);
}

main()
    .catch(err => {
        console.error('[Backfill] Critical migration error:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
