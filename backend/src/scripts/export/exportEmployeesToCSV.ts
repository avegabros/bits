import { prisma } from '../../shared/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Export employees to CSV format for ZKBio import (ZKBio format)
 */

async function main() {
    console.log('='.repeat(60));
    console.log('📄 EXPORT EMPLOYEES TO CSV FOR ZKBIO (v2)');
    console.log('='.repeat(60));

    try {
        // Get all active employees with zkId
        const employees = await prisma.employee.findMany({
            where: {
                zkId: { not: null },
                employmentStatus: 'ACTIVE',
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

        if (employees.length === 0) {
            console.log('\n⚠️  No employees found to export.\n');
            return;
        }

        console.log(`\n📋 Found ${employees.length} employees to export.\n`);

        // Create CSV content with proper ZKBio headers
        let csvContent = 'Emp ID,Name,Card No\n';

        employees.forEach((emp) => {
            const cardNo = emp.employeeNumber || '';
            const fullName = `${emp.firstName} ${emp.lastName}`;
            csvContent += `${emp.zkId},"${fullName}",${cardNo}\n`;
        });

        // Save to file
        const outputPath = path.join(__dirname, '..', '..', 'employees_zkbio.csv');
        fs.writeFileSync(outputPath, csvContent, 'utf-8');

        console.log(`✅ CSV file created: ${outputPath}\n`);
        console.log('📦 File contents preview:');
        console.log('─'.repeat(60));
        console.log(csvContent.split('\n').slice(0, 6).join('\n'));
        console.log('...');
        console.log('─'.repeat(60));
        console.log(`\n💡 Column mapping in ZKBio:`);
        console.log('   Column 1 (Emp ID) → Emp ID field');
        console.log('   Column 2 (Name) → Name field');
        console.log('   Column 3 (Card No) → Card No field (optional)');
        console.log(`\n📋 Next steps:`);
        console.log('1. In ZKBio import wizard, click "Auto fill"');
        console.log('2. Or manually set: Emp ID → Column 1');
        console.log('3. Click "start" to import\n');

    } catch (error: unknown) {
        console.error('\n❌ ERROR:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
