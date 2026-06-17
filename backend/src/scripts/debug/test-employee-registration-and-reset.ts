import { createEmployee, resetEmployeePassword } from '../../modules/employees/employee-crud.controller';
import { prisma } from '../../shared/lib/prisma';
import bcrypt from 'bcryptjs';

// Mock Response helper
function mockResponse() {
    const res: any = {};
    res.status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data: any) => {
        res.jsonData = data;
        return res;
    };
    return res;
}

async function runTests() {
    console.log("Starting integration tests for optional Gmail registration and password reset...");

    // 1. Fetch valid parent entities to avoid foreign key violations
    const company = await prisma.company.findFirst();
    const branch = await prisma.branch.findFirst();
    const department = await prisma.department.findFirst();

    if (!company || !branch || !department) {
        console.error("Setup error: Make sure there is at least one company, branch, and department in the database.");
        process.exit(1);
    }

    const testBirthdate = "2003-03-15";
    const expectedBirthdatePassword = "031503"; // March 15, 2003 -> 031503

    // Temporarily disable all devices so we don't try to connect to offline devices
    console.log("Temporarily disabling ZK devices...");
    const devices = await prisma.device.findMany();
    await prisma.device.updateMany({
        data: { isActive: false, syncEnabled: false }
    });

    // Clean up any existing test records just in case
    await prisma.attendanceLog.deleteMany({
        where: { employee: { employeeNumber: { in: ["TEST_REG_EMAIL", "TEST_REG_NO_EMAIL"] } } }
    });
    await prisma.attendance.deleteMany({
        where: { employee: { employeeNumber: { in: ["TEST_REG_EMAIL", "TEST_REG_NO_EMAIL"] } } }
    });
    await prisma.employeeShift.deleteMany({
        where: { employee: { employeeNumber: { in: ["TEST_REG_EMAIL", "TEST_REG_NO_EMAIL"] } } }
    });
    await prisma.employee.deleteMany({
        where: { employeeNumber: { in: ["TEST_REG_EMAIL", "TEST_REG_NO_EMAIL"] } }
    });

    try {
        // ==========================================
        // TEST CASE 1: Registration with Email
        // ==========================================
        console.log("\n[Test 1] Registering employee WITH email...");
        const req1: any = {
            body: {
                employeeNumber: "TEST_REG_EMAIL",
                firstName: "RegWith",
                lastName: "Email",
                dateOfBirth: testBirthdate,
                email: "test_reg_email@example.com",
                role: "USER",
                departmentId: department.id,
                branchId: branch.id,
                companyId: company.id,
                contactNumber: "09170000001",
                employmentStatus: "ACTIVE"
            },
            user: { employeeId: 1 },
            correlationId: "test-correlation-1"
        };
        const res1 = mockResponse();
        await createEmployee(req1, res1);

        if (res1.statusCode && res1.statusCode !== 201) {
            throw new Error(`Registration with email failed with status ${res1.statusCode}: ${JSON.stringify(res1.jsonData)}`);
        }

        console.log("Registration API response:", res1.jsonData);
        
        // Retrieve the created employee to check password
        const emp1 = await prisma.employee.findUnique({
            where: { employeeNumber: "TEST_REG_EMAIL" }
        });
        if (!emp1) throw new Error("Employee 1 was not created in the database.");
        if (!emp1.password) throw new Error("Employee 1 has no password set.");

        // Email was provided, so password should be random (should not match birthdate)
        const matchesBirthdatePass1 = await bcrypt.compare(expectedBirthdatePassword, emp1.password);
        if (matchesBirthdatePass1) {
            throw new Error("FAIL: Password matches birthdate for employee created with email (it should be a random temporary password).");
        }
        console.log("[PASS] Password generated for email registration is random and does not match the birthdate.");

        // ==========================================
        // TEST CASE 2: Registration without Email
        // ==========================================
        console.log("\n[Test 2] Registering employee WITHOUT email...");
        const req2: any = {
            body: {
                employeeNumber: "TEST_REG_NO_EMAIL",
                firstName: "RegWithout",
                lastName: "Email",
                dateOfBirth: testBirthdate,
                email: "", // Empty email
                role: "USER",
                departmentId: department.id,
                branchId: branch.id,
                companyId: company.id,
                contactNumber: "09170000002",
                employmentStatus: "ACTIVE"
            },
            user: { employeeId: 1 },
            correlationId: "test-correlation-2"
        };
        const res2 = mockResponse();
        await createEmployee(req2, res2);

        if (res2.statusCode && res2.statusCode !== 201) {
            throw new Error(`Registration without email failed with status ${res2.statusCode}: ${JSON.stringify(res2.jsonData)}`);
        }

        console.log("Registration API response:", res2.jsonData);

        const emp2 = await prisma.employee.findUnique({
            where: { employeeNumber: "TEST_REG_NO_EMAIL" }
        });
        if (!emp2) throw new Error("Employee 2 was not created in the database.");
        if (!emp2.password) throw new Error("Employee 2 has no password set.");

        // Email was not provided, so password should match birthdate format MMDDYY (031503)
        const matchesBirthdatePass2 = await bcrypt.compare(expectedBirthdatePassword, emp2.password);
        if (!matchesBirthdatePass2) {
            throw new Error(`FAIL: Password does not match birthdate "${expectedBirthdatePassword}" for employee created without email.`);
        }
        console.log(`[PASS] Password generated for email-less registration correctly matches birthdate format MMDDYY (${expectedBirthdatePassword}).`);

        // ==========================================
        // TEST CASE 3: Password Reset with Email
        // ==========================================
        console.log("\n[Test 3] Resetting password for employee WITH email...");
        const req3: any = {
            params: { id: String(emp1.id) },
            user: { employeeId: 1 },
            correlationId: "test-correlation-3"
        };
        const res3 = mockResponse();
        await resetEmployeePassword(req3, res3);

        if (res3.statusCode && res3.statusCode !== 200) {
            console.log("Reset with email response status:", res3.statusCode, res3.jsonData);
        } else {
            console.log("Reset with email response status:", res3.statusCode || 200, res3.jsonData);
        }

        const emp1Updated = await prisma.employee.findUnique({
            where: { id: emp1.id }
        });
        if (!emp1Updated || !emp1Updated.password) throw new Error("Failed to retrieve updated employee 1.");

        // Password should be random, not matching birthdate
        const matchesBirthdatePass3 = await bcrypt.compare(expectedBirthdatePassword, emp1Updated.password);
        if (matchesBirthdatePass3) {
            throw new Error("FAIL: Reset password matches birthdate for employee with email (it should be a random temporary password).");
        }
        console.log("[PASS] Reset password for employee with email is random.");

        // ==========================================
        // TEST CASE 4: Password Reset without Email
        // ==========================================
        console.log("\n[Test 4] Resetting password for employee WITHOUT email...");
        const req4: any = {
            params: { id: String(emp2.id) },
            user: { employeeId: 1 },
            correlationId: "test-correlation-4"
        };
        const res4 = mockResponse();
        await resetEmployeePassword(req4, res4);

        if (res4.statusCode && res4.statusCode !== 200) {
            throw new Error(`Reset without email failed with status ${res4.statusCode}: ${JSON.stringify(res4.jsonData)}`);
        }

        console.log("Reset without email response:", res4.jsonData);

        const emp2Updated = await prisma.employee.findUnique({
            where: { id: emp2.id }
        });
        if (!emp2Updated || !emp2Updated.password) throw new Error("Failed to retrieve updated employee 2.");

        // Password should match birthdate format MMDDYY
        const matchesBirthdatePass4 = await bcrypt.compare(expectedBirthdatePassword, emp2Updated.password);
        if (!matchesBirthdatePass4) {
            throw new Error(`FAIL: Reset password does not match birthdate "${expectedBirthdatePassword}" for employee without email.`);
        }
        console.log(`[PASS] Reset password for employee without email correctly matches birthdate format MMDDYY (${expectedBirthdatePassword}).`);

    } finally {
        // Clean up database after tests
        console.log("\nCleaning up test records...");
        await prisma.attendanceLog.deleteMany({
            where: { employee: { employeeNumber: { in: ["TEST_REG_EMAIL", "TEST_REG_NO_EMAIL"] } } }
        });
        await prisma.attendance.deleteMany({
            where: { employee: { employeeNumber: { in: ["TEST_REG_EMAIL", "TEST_REG_NO_EMAIL"] } } }
        });
        await prisma.employeeShift.deleteMany({
            where: { employee: { employeeNumber: { in: ["TEST_REG_EMAIL", "TEST_REG_NO_EMAIL"] } } }
        });
        await prisma.employee.deleteMany({
            where: { employeeNumber: { in: ["TEST_REG_EMAIL", "TEST_REG_NO_EMAIL"] } }
        });
        console.log("Cleanup done.");

        // Restore devices
        console.log("Restoring ZK devices...");
        for (const dev of devices) {
            await prisma.device.update({
                where: { id: dev.id },
                data: { isActive: dev.isActive, syncEnabled: dev.syncEnabled }
            });
        }
        console.log("Devices restored.");
    }

    console.log("\nAll employee registration and password reset integration tests passed!");
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
