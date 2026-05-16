import { prisma } from './src/shared/lib/prisma';

async function test() {
    const ots = await prisma.overtimeRequest.findMany({ take: 5, orderBy: { id: 'desc' } });
    const atts = await prisma.attendance.findMany({ take: 5, orderBy: { id: 'desc' } });
    
    console.log("=== Overtime Requests ===");
    ots.forEach(o => console.log(`OT ID: ${o.id}, Date: ${o.date.toISOString()}`));
    
    console.log("\n=== Attendance Records ===");
    atts.forEach(a => console.log(`ATT ID: ${a.id}, Date: ${a.date.toISOString()}`));
}

test();
