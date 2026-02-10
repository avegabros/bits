import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function testRoleBasedAccess() {
    console.log('🧪 Testing Role-Based Access Control\n');

    try {
        // Test 1: USER role should be rejected
        console.log('Test 1: USER role login (should fail with 403)');
        const userEmployee = await prisma.employee.findFirst({
            where: { role: 'USER' }
        });

        if (!userEmployee) {
            console.log('  ⚠️  No USER role employee found, creating one...');
            const hashedPassword = await bcrypt.hash('test123', 10);
            const newUser = await prisma.employee.create({
                data: {
                    firstName: 'Regular',
                    lastName: 'Employee',
                    email: 'employee@test.com',
                    password: hashedPassword,
                    role: 'USER'
                }
            });
            console.log('  ✓ Created USER employee:', newUser.email);
        }

        const userLoginTest = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: userEmployee?.email || 'employee@test.com',
                password: 'test123'
            })
        });
        const userResult = await userLoginTest.json();

        if (userLoginTest.status === 403) {
            console.log('  ✅ PASSED: USER role correctly rejected');
            console.log('  Message:', userResult.message);
        } else {
            console.log('  ❌ FAILED: USER role should be rejected with 403');
            console.log('  Got:', userLoginTest.status, userResult);
        }

        // Test 2: HR role should succeed
        console.log('\nTest 2: HR role login (should succeed)');
        let hrEmployee = await prisma.employee.findFirst({
            where: { role: 'HR' }
        });
        if (!hrEmployee) {
            console.log('  ⚠️  No HR employee found, creating one...');
            const hashedPassword = await bcrypt.hash('hr123', 10);
            hrEmployee = await prisma.employee.create({
                data: {
                    firstName: 'HR',
                    lastName: 'Manager',
                    email: 'hr@test.com',
                    password: hashedPassword,
                    role: 'HR'
                }
            });
            console.log('  ✓ Created HR employee:', hrEmployee.email);
        }

        const hrLoginTest = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: hrEmployee.email,
                password: 'hr123'
            })
        });
        const hrResult = await hrLoginTest.json();

        if (hrLoginTest.status === 200 && hrResult.success) {
            console.log('  ✅ PASSED: HR role successfully logged in');
            if (hrResult.user) {
                console.log('  User:', `${hrResult.user.firstName} ${hrResult.user.lastName}`, `(${hrResult.user.role})`);
            }
        } else {
            console.log('  ❌ FAILED: HR role should be able to login');
            console.log('  Got:', hrLoginTest.status, hrResult);
        }

        // Test 3: ADMIN role should succeed
        console.log('\nTest 3: ADMIN role login (should succeed)');
        let adminEmployee = await prisma.employee.findFirst({
            where: { role: 'ADMIN' }
        });

        if (!adminEmployee) {
            console.log('  ⚠️  No ADMIN employee found, creating one...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            adminEmployee = await prisma.employee.create({
                data: {
                    firstName: 'System',
                    lastName: 'Admin',
                    email: 'admin@test.com',
                    password: hashedPassword,
                    role: 'ADMIN'
                }
            });
            console.log('  ✓ Created ADMIN employee:', adminEmployee.email);
        }

        const adminLoginTest = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: adminEmployee.email,
                password: 'admin123'
            })
        });
        const adminResult = await adminLoginTest.json();

        if (adminLoginTest.status === 200 && adminResult.success) {
            console.log('  ✅ PASSED: ADMIN role successfully logged in');
            if (adminResult.user) {
                console.log('  User:', `${adminResult.user.firstName} ${adminResult.user.lastName}`, `(${adminResult.user.role})`);
            }
        } else {
            console.log('  ❌ FAILED: ADMIN role should be able to login');
            console.log('  Got:', adminLoginTest.status, adminResult);
        }

        console.log('\n✅ Role-Based Access Control Tests Complete!');

    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testRoleBasedAccess();
