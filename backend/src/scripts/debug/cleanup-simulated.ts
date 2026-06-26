import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting cleanup of simulated database records...');

    const employee = await prisma.employee.findFirst({
        where: { firstName: 'Simulated', lastName: 'Employee' }
    });

    if (employee) {
        console.log(`Found Simulated Employee (ID: ${employee.id}). Deleting records...`);
        
        const logsDeleted = await prisma.attendanceLog.deleteMany({ where: { employeeId: employee.id } });
        console.log(`Deleted ${logsDeleted.count} attendance logs.`);

        const attendanceDeleted = await prisma.attendance.deleteMany({ where: { employeeId: employee.id } });
        console.log(`Deleted ${attendanceDeleted.count} attendance records.`);

        const otDeleted = await prisma.overtimeRequest.deleteMany({ where: { employeeId: employee.id } });
        console.log(`Deleted ${otDeleted.count} overtime requests.`);

        const shiftLinksDeleted = await prisma.employeeShift.deleteMany({ where: { employeeId: employee.id } });
        console.log(`Deleted ${shiftLinksDeleted.count} employee shift assignments.`);

        await prisma.employee.delete({ where: { id: employee.id } });
        console.log(`Deleted Simulated Employee.`);
    } else {
        console.log('No Simulated Employee record found.');
    }

    const shift = await prisma.shift.findFirst({
        where: { shiftCode: 'S_NIGHT' }
    });

    if (shift) {
        console.log(`Found simulated shift S_NIGHT (ID: ${shift.id}). Deleting...`);
        await prisma.employeeShift.deleteMany({ where: { shiftId: shift.id } });
        await prisma.attendance.deleteMany({ where: { shiftId: shift.id } });
        await prisma.shift.delete({ where: { id: shift.id } });
        console.log('Deleted shift S_NIGHT.');
    } else {
        console.log('No S_NIGHT shift found.');
    }

    console.log('Cleanup complete!');
}

main()
    .catch((e) => {
        console.error('Error during cleanup:', e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
