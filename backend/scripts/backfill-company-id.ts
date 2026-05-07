/**
 * One-time backfill script: assign companyId to employees
 * based on their branch's company assignment.
 *
 * - If branch has exactly 1 company → auto-assign companyId
 * - If branch has 0 or 2+ companies → leave null (admin must manually assign)
 * - If employee has no branch → leave null
 *
 * Usage: npx ts-node scripts/backfill-company-id.ts
 *   or:  node -e "require('./scripts/backfill-company-id')"
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting companyId backfill...\n');

  // 1. Get all employees with no companyId
  const employees = await prisma.employee.findMany({
    where: { companyId: null },
    select: { id: true, firstName: true, lastName: true, branchId: true },
  });

  console.log(`Found ${employees.length} employees with no companyId.\n`);

  // 2. Get all branches with their company links
  const branches = await prisma.branch.findMany({
    include: {
      companies: {
        include: { company: { select: { id: true, name: true } } },
      },
    },
  });

  // Build branch → companies lookup
  const branchCompanyMap = new Map<number, { id: number; name: string }[]>();
  for (const branch of branches) {
    branchCompanyMap.set(
      branch.id,
      branch.companies.map((link) => link.company)
    );
  }

  let autoAssigned = 0;
  let skippedNoBranch = 0;
  let skippedMultiple = 0;
  let skippedNoCompany = 0;

  for (const emp of employees) {
    if (!emp.branchId) {
      skippedNoBranch++;
      continue;
    }

    const companies = branchCompanyMap.get(emp.branchId) || [];

    if (companies.length === 0) {
      skippedNoCompany++;
      continue;
    }

    if (companies.length > 1) {
      console.log(
        `⚠️  ${emp.firstName} ${emp.lastName} (ID ${emp.id}): branch has ${companies.length} companies → skipping (manual assignment needed)`
      );
      skippedMultiple++;
      continue;
    }

    // Exactly one company — auto-assign
    const company = companies[0];
    await prisma.employee.update({
      where: { id: emp.id },
      data: { companyId: company.id },
    });
    autoAssigned++;
    console.log(
      `✅ ${emp.firstName} ${emp.lastName} (ID ${emp.id}) → ${company.name}`
    );
  }

  console.log('\n──────────────── Summary ────────────────');
  console.log(`✅ Auto-assigned:       ${autoAssigned}`);
  console.log(`⚠️  Skipped (multi-co):  ${skippedMultiple}`);
  console.log(`⏭️  Skipped (no branch): ${skippedNoBranch}`);
  console.log(`⏭️  Skipped (no company):${skippedNoCompany}`);
  console.log(`📋 Total processed:     ${employees.length}`);
  console.log(
    `\n${skippedMultiple + skippedNoBranch + skippedNoCompany > 0 ? '⚠️  Some employees still need manual company assignment via the admin panel.' : '🎉 All employees assigned!'}`
  );
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
