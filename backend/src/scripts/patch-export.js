const fs = require('fs');
const path = require('path');

const file = path.join('c:/bits/backend/src/modules/employees/employee-export.controller.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /Shift: \{ select: \{ shiftCode: true \} \},/g,
    `Shift: { select: { shiftCode: true } },
                EmployeeShift: { select: { shift: { select: { shiftCode: true } } }, orderBy: { sortOrder: 'asc' } },`
);

content = content.replace(
    /shiftCode: emp\.Shift\?\.shiftCode \|\| '',/g,
    `shiftCode: emp.EmployeeShift?.length ? emp.EmployeeShift.map(es => es.shift.shiftCode).join(',') : (emp.Shift?.shiftCode || ''),`
);

content = content.replace(
    /shiftId: emp\.shiftId \? parseInt\(emp\.shiftId, 10\) : null,/g,
    `shiftId: emp.shiftId ? parseInt(emp.shiftId, 10) : null,
                            ...(emp.shiftId ? {
                                EmployeeShift: {
                                    create: { shiftId: parseInt(emp.shiftId, 10), sortOrder: 0, isPrimary: true }
                                }
                            } : {}),`
);

fs.writeFileSync(file, content);
console.log('Successfully patched employee-export.controller.ts');
