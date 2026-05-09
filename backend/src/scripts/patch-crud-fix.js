const fs = require('fs');
const path = require('path');

const file = path.join('c:/bits/backend/src/modules/employees/employee-crud.controller.ts');
let content = fs.readFileSync(file, 'utf8');

// 1. Add EmployeeShift select to all existing Shift selects
const esSelect = `
                EmployeeShift: {
                    select: {
                        id: true,
                        sortOrder: true,
                        isPrimary: true,
                        shift: { select: { id: true, name: true, shiftCode: true, startTime: true, endTime: true, workDays: true, halfDays: true, graceMinutes: true, breakMinutes: true, isNightShift: true } }
                    },
                    orderBy: { sortOrder: 'asc' }
                },`;

content = content.replace(
    /Shift: \{ select: \{ id: true, name: true, shiftCode: true, startTime: true, endTime: true, workDays: true, halfDays: true, graceMinutes: true, breakMinutes: true, isNightShift: true \} \},/g,
    `Shift: { select: { id: true, name: true, shiftCode: true, startTime: true, endTime: true, workDays: true, halfDays: true, graceMinutes: true, breakMinutes: true, isNightShift: true } },${esSelect}`
);

// 2. Add shiftIds to createEmployee destructuring
// Match "shiftId,\r\n            companyId\r\n        } = req.body;"
content = content.replace(
    /shiftId,\r?\n\s*companyId\r?\n\s*\} = req\.body;/,
    `shiftId,\n            shiftIds,\n            companyId\n        } = req.body;`
);

// 3. Add shiftIds to updateEmployee destructuring  
// Match "shiftId,\r\n            needsPasswordChange"
content = content.replace(
    /shiftId,\r?\n(\s*)needsPasswordChange/,
    `shiftId,\n$1shiftIds,\n$1needsPasswordChange`
);

// 4. Add min gap validation before createEmployee mutex
content = content.replace(
    /let newEmployee;\r?\n\s*const generatedPassword = generateRandomPassword\(10\);/,
    `// Validate min gap
        if (shiftIds && Array.isArray(shiftIds) && shiftIds.length > 1) {
            const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
            const minGap = syncConfig?.minShiftGapMinutes ?? 30;
            const shifts = await prisma.shift.findMany({ where: { id: { in: shiftIds } } });
            
            const orderedShifts = shiftIds.map((id: number) => shifts.find((s: any) => s.id === id)).filter(Boolean);
            for (let i = 0; i < orderedShifts.length - 1; i++) {
                const current = orderedShifts[i];
                const next = orderedShifts[i+1];
                if (current && next) {
                    const [cH, cM] = current.endTime.split(':').map(Number);
                    const [nH, nM] = next.startTime.split(':').map(Number);
                    let gap = (nH * 60 + nM) - (cH * 60 + cM);
                    if (gap < 0 && current.isNightShift) gap += 24 * 60;
                    if (gap < minGap && gap > -12*60) {
                        return res.status(400).json({ success: false, message: \`Minimum gap of \${minGap} minutes between shifts not met (\${current.name} to \${next.name})\` });
                    }
                }
            }
        }

        let newEmployee: any;
        const generatedPassword = generateRandomPassword(10);`
);

// 5. Add EmployeeShift createMany after employee creation
content = content.replace(
    /employmentStatus: true,\s*createdAt: true,?\s*\}\r?\n\s*\}\);/,
    `employmentStatus: true, createdAt: true }
            });

            if (shiftIds && Array.isArray(shiftIds) && shiftIds.length > 0) {
                await prisma.employeeShift.createMany({
                    data: shiftIds.map((sid: number, i: number) => ({
                        employeeId: newEmployee.id,
                        shiftId: sid,
                        sortOrder: i,
                        isPrimary: i === 0
                    }))
                });
            }`
);

// 6. Add EmployeeShift management to updateEmployee
content = content.replace(
    /if \(shiftId !== undefined\) updateData\.shiftId = shiftId \? parseInt\(shiftId as string, 10\) : null;/,
    `if (shiftId !== undefined) updateData.shiftId = shiftId ? parseInt(shiftId as string, 10) : null;
        if (shiftIds !== undefined) {
            await prisma.employeeShift.deleteMany({ where: { employeeId } });
            if (Array.isArray(shiftIds) && shiftIds.length > 0) {
                const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
                const minGap = syncConfig?.minShiftGapMinutes ?? 30;
                const gapShifts = await prisma.shift.findMany({ where: { id: { in: shiftIds } } });
                
                const orderedShifts = shiftIds.map((id: number) => gapShifts.find((s: any) => s.id === id)).filter(Boolean);
                for (let i = 0; i < orderedShifts.length - 1; i++) {
                    const current = orderedShifts[i];
                    const next = orderedShifts[i+1];
                    if (current && next) {
                        const [cH, cM] = current.endTime.split(':').map(Number);
                        const [nH, nM] = next.startTime.split(':').map(Number);
                        let gap = (nH * 60 + nM) - (cH * 60 + cM);
                        if (gap < 0 && current.isNightShift) gap += 24 * 60;
                        if (gap < minGap && gap > -12*60) {
                            return res.status(400).json({ success: false, message: \`Minimum gap of \${minGap} minutes between shifts not met\` });
                        }
                    }
                }

                await prisma.employeeShift.createMany({
                    data: shiftIds.map((sid: number, i: number) => ({
                        employeeId,
                        shiftId: sid,
                        sortOrder: i,
                        isPrimary: i === 0
                    }))
                });
                updateData.shiftId = shiftIds[0];
            } else {
                updateData.shiftId = null;
            }
        }`
);

fs.writeFileSync(file, content);
console.log('Successfully patched employee-crud.controller.ts (fixed version)');
