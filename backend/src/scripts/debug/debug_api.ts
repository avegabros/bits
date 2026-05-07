import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';


const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3001/api';

async function main() {
    console.log('--- STARTING API DEBUG ---');

    // 1. Create Temp Admin
    const email = 'debug_admin_' + Date.now() + '@test.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    let admin = await prisma.employee.create({
        data: {
            email,
            password: hashedPassword,
            firstName: 'Debug',
            lastName: 'Admin',
            role: 'ADMIN',
            employmentStatus: 'ACTIVE',
            zkId: 99999, // dummy
            employeeNumber: 'DEBUG',
            updatedAt: new Date()
        }
    });

    try {
        console.log(`Created temp admin: ${email}`);

        // 2. Login
        console.log('Attempting login...');
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!loginRes.ok) {
            throw new Error(`Login failed: ${loginRes.status} ${loginRes.statusText}`);
        }

        const loginData = await loginRes.json();
        // Adjust based on actual login response structure. usually { token: ... } or { data: { token: ... } }
        const token = loginData.token || loginData.data?.token;

        if (!token) {
            console.error('Login response:', loginData);
            throw new Error('No token returned from login');
        }
        console.log('Login successful. Token received.');

        // 3. Fetch Attendance
        console.log('Fetching attendance...');
        const attRes = await fetch(`${BASE_URL}/attendance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log(`Attendance API Status: ${attRes.status}`);
        const attData = await attRes.json();

        console.log('Attendance API Response success:', attData.success);
        console.log('Attendance API Response count:', attData.count);

        if (attData.data && Array.isArray(attData.data)) {
            console.log(`Actual array length: ${attData.data.length}`);
            if (attData.data.length > 0) {
                console.log('Sample record:', JSON.stringify(attData.data[0], null, 2));
            }
        } else {
            console.log('Data is not an array:', attData.data);
        }

    } catch (error) {
        console.error('DEBUG FAILED:', error);
    } finally {
        // 4. Cleanup
        await prisma.employee.delete({ where: { id: admin.id } });
        console.log('Cleanup complete.');
        await prisma.$disconnect();
    }
}

main();
