import { prisma } from '../../shared/lib/prisma';

async function main() {
    console.log('--- ENROLLING TEST FINGERPRINT BIOMETRIC ---');

    // 1. Get or create a test employee
    let employee = await prisma.employee.findFirst({
        where: { email: 'admin@avegabros.com' }
    });

    if (!employee) {
        employee = await prisma.employee.findFirst();
    }

    if (!employee) {
        console.log('No employee found, creating a test employee...');
        employee = await prisma.employee.create({
            data: {
                firstName: 'Test',
                lastName: 'BiometricUser',
                email: 'test.biometric@example.com',
                role: 'USER',
                employmentStatus: 'ACTIVE',
                updatedAt: new Date()
            }
        });
    }

    console.log(`Using Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.id})`);

    // 2. Get or create a test device
    let device = await prisma.device.findFirst();
    if (!device) {
        console.log('No device found, creating a mockup device...');
        device = await prisma.device.create({
            data: {
                name: 'Office Main Gate ZK',
                ip: '192.168.1.201',
                port: 4370,
                location: 'Main Lobby',
                isActive: true,
                syncEnabled: true,
                updatedAt: new Date()
            }
        });
    }

    console.log(`Using Device: ${device.name} (ID: ${device.id}, IP: ${device.ip})`);

    // 3. Enroll employee on the device if not already enrolled
    const deviceEnrollment = await prisma.employeeDeviceEnrollment.upsert({
        where: {
            employeeId_deviceId: {
                employeeId: employee.id,
                deviceId: device.id
            }
        },
        update: {},
        create: {
            employeeId: employee.id,
            deviceId: device.id
        }
    });
    console.log(`Device enrollment verified (ID: ${deviceEnrollment.id})`);

    // 4. Create fingerprint enrollment
    const fingerprint = await prisma.employeeFingerprintEnrollment.upsert({
        where: {
            employeeId_deviceId_fingerIndex: {
                employeeId: employee.id,
                deviceId: device.id,
                fingerIndex: 0
            }
        },
        update: {
            fingerLabel: 'Right Thumb'
        },
        create: {
            employeeId: employee.id,
            deviceId: device.id,
            fingerIndex: 0,
            fingerLabel: 'Right Thumb'
        }
    });

    console.log(`Fingerprint biometric enrollment successfully registered in DB!`);
    console.log(JSON.stringify(fingerprint, null, 2));
}

main()
    .catch((err) => {
        console.error('Error executing script:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
