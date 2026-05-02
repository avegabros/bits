const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting companyId backfill...\n');

  const employees = await prisma.employee.findMany({
    where: { companyId: null },
    select: { id: true, firstName: true, lastName: true, branchId: true },
  });

  console.log(`Found ${employees.length} employees with no companyId.\n`);

  const branches = await prisma.branch.findMany({
    include: {
      companies: {
        include: { company: { select: { id: true, name: true } } },
      },
    },
  });

  const branchMap = new Map();
  for (const b of branches) {
    branchMap.set(b.id, b.companies.map((l) => l.company));
  }

  let autoAssigned = 0;
  let skippedMultiple = 0;
  let skippedNoBranch = 0;
  let skippedNoCompany = 0;

  for (const emp of employees) {
    if (!emp.branchId) {
      skippedNoBranch++;
      continue;
    }

    const companies = branchMap.get(emp.branchId) || [];

    if (companies.length === 0) {
      skippedNoCompany++;
      continue;
    }

    if (companies.length > 1) {
      console.log(
        `MULTI: ${emp.firstName} ${emp.lastName} (ID ${emp.id}): branch has ${companies.length} companies -> skipping`
      );
      skippedMultiple++;
      continue;
    }

    const company = companies[0];
    await prisma.employee.update({
      where: { id: emp.id },
      data: { companyId: company.id },
    });
    autoAssigned++;
    console.log(`OK: ${emp.firstName} ${emp.lastName} (ID ${emp.id}) -> ${company.name}`);
  }

  console.log('\n--- Summary ---');
  console.log(`Auto-assigned:       ${autoAssigned}`);
  console.log(`Skipped (multi-co):  ${skippedMultiple}`);
  console.log(`Skipped (no branch): ${skippedNoBranch}`);
  console.log(`Skipped (no company):${skippedNoCompany}`);
  console.log(`Total processed:     ${employees.length}`);
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
