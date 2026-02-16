import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // Check if admin already exists
    const existingAdmin = await prisma.employee.findFirst({
        where: { role: 'ADMIN' }
    });

    if (existingAdmin) {
        console.log('Admin user already exists:', existingAdmin.email);
        return;
    }

    // Create new admin
    const password = await bcrypt.hash('admin123', 10);

    // Find next available zkId
    const maxZkId = await prisma.employee.findFirst({
        orderBy: { zkId: 'desc' },
        select: { zkId: true }
    });

    const nextZkId = (maxZkId?.zkId || 0) + 1;

    const admin = await prisma.employee.create({
        data: {
            email: 'admin@bits.com',
            firstName: 'Admin',
            lastName: 'User',
            password,
            role: 'ADMIN',
            employmentStatus: 'ACTIVE',
            zkId: nextZkId,
            employeeNumber: 'ADMIN002'
        },
    });

    console.log('Created admin user:', admin.email);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
