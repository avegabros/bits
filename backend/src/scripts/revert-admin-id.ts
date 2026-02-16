import { prisma } from '../lib/prisma';

async function main() {
    console.log('Reverting Admin User ID to 1...');
    try {
        // Update Admin (zkId: 1) to have employeeNumber null (so it defaults to zkId 1)
        // or string "1" if we want to be explicit. null is better for the logic `employeeNumber || zkId`.
        const admin = await prisma.employee.update({
            where: { zkId: 1 },
            data: { employeeNumber: null }
        });
        console.log('Admin updated successfully.');
        console.log('New State:', {
            firstName: admin.firstName,
            zkId: admin.zkId,
            employeeNumber: admin.employeeNumber
        });

    } catch (error) {
        console.error('Operation failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
