import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function testRegistration() {
    try {
        console.log('🧪 Testing user registration...\n');

        const testUser = {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            password: 'password123',
            role: 'USER' as const,
        };

        console.log('📝 Creating user:', `${testUser.firstName} ${testUser.lastName}`);

        // Check if user already exists
        const existing = await prisma.employee.findFirst({
            where: { email: testUser.email }
        });

        if (existing) {
            console.log('⚠️  User already exists! Deleting old user first...');
            await prisma.employee.delete({ where: { id: existing.id } });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(testUser.password, 10);

        // Create user
        const newUser = await prisma.employee.create({
            data: {
                firstName: testUser.firstName,
                lastName: testUser.lastName,
                email: testUser.email,
                password: hashedPassword,
                role: testUser.role,
            }
        });

        console.log('\n✅ Registration successful!');
        console.log('📊 User created:');
        console.log({
            id: newUser.id,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.createdAt,
        });

        console.log('\n🔍 Check Prisma Studio at http://localhost:5555 to verify!');
    } catch (error: any) {
        console.error('\n❌ Registration failed:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

testRegistration();