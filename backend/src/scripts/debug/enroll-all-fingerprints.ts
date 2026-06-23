import { prisma } from '../../shared/lib/prisma';

async function main() {
    console.log('--- ENROLLING TEST FINGERPRINTS FOR ALL EMPLOYEES ---');

    // 1. Get all employees
    const employees = await prisma.employee.findMany();
    if (employees.length === 0) {
        console.log('No employees found in DB.');
        return;
    }

    // 2. Get all devices
    const devices = await prisma.device.findMany();
    if (devices.length === 0) {
        console.log('No devices found in DB. Creating a default test device...');
        const newDevice = await prisma.device.create({
            data: {
                name: 'Device Main',
                ip: '192.168.0.30',
                port: 4370,
                location: 'Office Lobby',
                isActive: true,
                syncEnabled: true,
                updatedAt: new Date()
            }
        });
        devices.push(newDevice);
    }

    console.log(`Found ${employees.length} employees and ${devices.length} devices.`);

    for (const employee of employees) {
        console.log(`Processing Employee: ${employee.firstName} ${employee.lastName} (ID: ${employee.id})`);
        
        for (const device of devices) {
            // Enroll employee on device
            await prisma.employeeDeviceEnrollment.upsert({
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

            // Enroll fingerprint slot (fingerIndex 0)
            await prisma.employeeFingerprintEnrollment.upsert({
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
            console.log(`  -> Enrolled finger 0 on device ${device.name}`);
        }
    }

    console.log('\n--- SUCCESS: Enrolled test fingerprints globally in DB! ---');
}

main()
    .catch((err) => {
        console.error('Error executing script:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
