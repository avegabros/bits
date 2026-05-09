const fs = require('fs');
const path = require('path');

const file = path.join('c:/bits/backend/src/modules/employees/employee-crud.controller.ts');
let content = fs.readFileSync(file, 'utf8');

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

// Patch getEmployeeById
content = content.replace(
    /Shift: \{ select: \{ id: true, name: true, shiftCode: true, startTime: true, endTime: true, workDays: true, halfDays: true, graceMinutes: true, breakMinutes: true, isNightShift: true \} \},/g,
    `Shift: { select: { id: true, name: true, shiftCode: true, startTime: true, endTime: true, workDays: true, halfDays: true, graceMinutes: true, breakMinutes: true, isNightShift: true } },${esSelect}`
);

// Extract shiftIds in createEmployee
content = content.replace(
    /const \{([\s\S]*?)shiftId,\s*profilePicture([\s\S]*?)\} = req\.body;/g,
    `const {$1shiftId, shiftIds, profilePicture$2} = req.body;`
);

// Create EmployeeShift in createEmployee
content = content.replace(
    /let newEmployee;\s*const generatedPassword = generateRandomPassword\(10\);/g,
    `// Validate min gap
        if (shiftIds && Array.isArray(shiftIds) && shiftIds.length > 1) {
            const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
            const minGap = syncConfig?.minShiftGapMinutes ?? 30;
            const shifts = await prisma.shift.findMany({ where: { id: { in: shiftIds } } });
            
            const orderedShifts = shiftIds.map(id => shifts.find(s => s.id === id)).filter(Boolean);
            for (let i = 0; i < orderedShifts.length - 1; i++) {
                const current = orderedShifts[i];
                const next = orderedShifts[i+1];
                if (current && next) {
                    const [cH, cM] = current.endTime.split(':').map(Number);
                    const [nH, nM] = next.startTime.split(':').map(Number);
                    let gap = (nH * 60 + nM) - (cH * 60 + cM);
                    if (gap < 0 && current.isNightShift) gap += 24 * 60; // Approx
                    if (gap < minGap && gap > -12*60) {
                        return res.status(400).json({ success: false, message: \`Minimum gap of \${minGap} minutes between shifts not met (\${current.name} to \${next.name})\` });
                    }
                }
            }
        }

        let newEmployee;
        const generatedPassword = generateRandomPassword(10);`
);

content = content.replace(
    /select: \{\s*id: true,\s*zkId: true,\s*employeeNumber: true/g,
    `select: { id: true, zkId: true, employeeNumber: true`
);

content = content.replace(
    /employmentStatus: true,\s*createdAt: true,\s*\}\s*\}\);/g,
    `employmentStatus: true, createdAt: true }
            });

            if (shiftIds && Array.isArray(shiftIds) && shiftIds.length > 0) {
                await prisma.employeeShift.createMany({
                    data: shiftIds.map((sid, i) => ({
                        employeeId: newEmployee.id,
                        shiftId: sid,
                        sortOrder: i,
                        isPrimary: i === 0
                    }))
                });
            }`
);

// Extract shiftIds in updateEmployee
content = content.replace(
    /const \{([\s\S]*?)shiftId,\s*needsPasswordChange([\s\S]*?)\} = req\.body;/g,
    `const {$1shiftId, shiftIds, needsPasswordChange$2} = req.body;`
);

// Update EmployeeShift in updateEmployee
content = content.replace(
    /if \(shiftId !== undefined\) updateData\.shiftId = shiftId \? parseInt\(shiftId as string, 10\) : null;/g,
    `if (shiftId !== undefined) updateData.shiftId = shiftId ? parseInt(shiftId as string, 10) : null;
        if (shiftIds !== undefined) {
            await prisma.employeeShift.deleteMany({ where: { employeeId } });
            if (Array.isArray(shiftIds) && shiftIds.length > 0) {
                const syncConfig = await prisma.syncConfig.findUnique({ where: { id: 1 } });
                const minGap = syncConfig?.minShiftGapMinutes ?? 30;
                const shifts = await prisma.shift.findMany({ where: { id: { in: shiftIds } } });
                
                const orderedShifts = shiftIds.map(id => shifts.find(s => s.id === id)).filter(Boolean);
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
                    data: shiftIds.map((sid, i) => ({
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
console.log('Successfully patched employee-crud.controller.ts');
