import { prisma } from '../../shared/lib/prisma';

async function main() {
    console.log('Querying fingerprint status in DB...');
    const employees = await prisma.employee.findMany({
        where: { employmentStatus: 'ACTIVE', zkId: { not: null } },
        select: { id: true, zkId: true, firstName: true, lastName: true }
    });

    console.log(`Found ${employees.length} active employees with zkId.`);

    for (const emp of employees) {
        const enrollments = await prisma.employeeFingerprintEnrollment.findMany({
            where: { employeeId: emp.id }
        });
        const deviceEnrollments = await prisma.employeeDeviceEnrollment.findMany({
            where: { employeeId: emp.id }
        });

        if (enrollments.length > 0) {
            console.log(`Employee: ${emp.firstName} ${emp.lastName} (zkId: ${emp.zkId})`);
            console.log(`  Fingerprint Enrollments: ${enrollments.length} slot(s) [${enrollments.map(e => `${e.fingerIndex} (device: ${e.deviceId})`).join(', ')}]`);
            console.log(`  Device Enrollments: ${deviceEnrollments.length} device(s) [${deviceEnrollments.map(e => e.deviceId).join(', ')}]`);
        }
    }
}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
