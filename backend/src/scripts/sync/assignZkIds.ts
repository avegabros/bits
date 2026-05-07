import { prisma } from '../../shared/lib/prisma';

/**
 * CLI Script: Assign zkIds to Employees
 * 
 * Usage: npm run assign-zkids
 * 
 * This script assigns zkId values to employees who don't have one yet.
 * Strategy: Use the employee's database ID as their zkId for simplicity.
 */

async function main() {
    console.log('='.repeat(60));
    console.log('🔢 ASSIGN ZKIDS TO EMPLOYEES');
    console.log('='.repeat(60));

    try {
        // 1. Check current status
        const allEmployees = await prisma.employee.findMany({
            select: {
                id: true,
                zkId: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                employmentStatus: true,
            },
            orderBy: {
                id: 'asc',
            }
        });

        const withZkId = allEmployees.filter((e) => e.zkId !== null);
        const withoutZkId = allEmployees.filter((e) => e.zkId === null);

        console.log(`\n📊 Current Status:`);
        console.log(`   Total Employees: ${allEmployees.length}`);
        console.log(`   ✅ With zkId: ${withZkId.length}`);
        console.log(`   ❌ Without zkId: ${withoutZkId.length}`);

        if (withoutZkId.length === 0) {
            console.log('\n✅ All employees already have zkIds assigned!\n');

            // Show current assignments
            console.log('Current zkId Assignments:');
            allEmployees.forEach((emp, idx) => {
                const empNum = emp.employeeNumber ? ` (${emp.employeeNumber})` : '';
                const fullName = `${emp.firstName} ${emp.lastName}`;
                const status = emp.employmentStatus;
                console.log(`   ${idx + 1}. ${fullName}${empNum} - zkId: ${emp.zkId} [${status}]`);
            });
            console.log('');
            return;
        }
        // 2. Show employees that need zkId assignment
        console.log(`\n📋 Employees without zkId:\n`);
        withoutZkId.forEach((emp, idx) => {
            const empNum = emp.employeeNumber ? ` (${emp.employeeNumber})` : '';
            const fullName = `${emp.firstName} ${emp.lastName}`;
            console.log(`   ${idx + 1}. ID: ${emp.id} - ${fullName}${empNum} [${emp.employmentStatus}]`);
        });

        console.log(`\n🔄 Assigning zkIds (using database ID as zkId)...\n`);

        // 3. Assign zkIds
        let assignedCount = 0;
        for (const emp of withoutZkId) {
            try {
                await prisma.employee.update({
                    where: { id: emp.id },
                    data: { zkId: emp.id },
                });

                const empNum = emp.employeeNumber ? ` (${emp.employeeNumber})` : '';
                const fullName = `${emp.firstName} ${emp.lastName}`;
                console.log(`   ✓ ${fullName}${empNum} → zkId: ${emp.id}`);
                assignedCount++;
            } catch (error: unknown) {
                const fullName = `${emp.firstName} ${emp.lastName}`;
                console.error(`   ✗ Failed to assign zkId to ${fullName}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✅ ASSIGNMENT COMPLETE!`);
        console.log(`📊 Assigned ${assignedCount} zkIds`);
        console.log('='.repeat(60));

        // 4. Show final status
        const updatedEmployees = await prisma.employee.findMany({
            where: {
                employmentStatus: 'ACTIVE',
                zkId: { not: null },
            },
            select: {
                zkId: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
            },
            orderBy: {
                zkId: 'asc',
            }
        });
        console.log(`\n💡 Ready to sync to device:`);
        console.log(`   ${updatedEmployees.length} ACTIVE employees with zkId assigned\n`);

        console.log('🚀 Next Step: Run the sync command:');
        console.log('   npm run sync-employees\n');

    } catch (error: unknown) {
        console.error('\n❌ ERROR:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error) console.error('\nStack trace:', error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
