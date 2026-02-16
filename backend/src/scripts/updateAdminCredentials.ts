import { prisma } from '../lib/prisma';
import * as bcrypt from 'bcrypt';

async function main() {
    console.log('🔐 Updating admin user credentials...\n');

    const email = 'admin@avegbros.com';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update the existing admin user
    const updated = await prisma.employee.update({
        where: { email },
        data: {
            password: hashedPassword,
            role: 'ADMIN' // Change role to ADMIN for full access
        }
    });

    console.log('✅ Admin user updated successfully!');
    console.log('\n📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Role:', updated.role);
    console.log('\nYou can now login with these credentials in Swagger!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
