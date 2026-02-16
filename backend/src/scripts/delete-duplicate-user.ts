import { prisma } from '../lib/prisma';

async function main() {
    console.log('Deleting duplicate user 2948876...');
    try {
        const user = await prisma.employee.findUnique({ where: { zkId: 2948876 } });
        if (!user) {
            console.log('User not found.');
            return;
        }

        const deleted = await prisma.employee.delete({
            where: { zkId: 2948876 },
        });
        console.log('User deleted successfully:', deleted.id, deleted.firstName, deleted.lastName);

    } catch (error) {
        console.error('Operation failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
