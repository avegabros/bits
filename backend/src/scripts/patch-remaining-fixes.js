const fs = require('fs');

// Fix 1: attendance.service.ts - remove shift:true from attendanceLog query
let attsvc = fs.readFileSync('c:/bits/backend/src/modules/attendance/attendance.service.ts', 'utf8');
attsvc = attsvc.replace(
    'include: { employee: { include: { Shift: true } }, shift: true }',
    'include: { employee: { include: { Shift: true } } }'
);
fs.writeFileSync('c:/bits/backend/src/modules/attendance/attendance.service.ts', attsvc);
console.log('Fixed attendance.service.ts: removed invalid shift:true from AttendanceLog query');

// Fix 2: attendance.controller.ts - use shift connect syntax for updateData.shiftId
let attctrl = fs.readFileSync('c:/bits/backend/src/modules/attendance/attendance.controller.ts', 'utf8');
attctrl = attctrl.replace(
    /updateData\.shiftId = resolvedShift\.id;/g,
    'updateData.shift = { connect: { id: resolvedShift.id } };'
);
fs.writeFileSync('c:/bits/backend/src/modules/attendance/attendance.controller.ts', attctrl);
console.log('Fixed attendance.controller.ts: used shift connect syntax');

// Fix 3: employee-export.controller.ts - remove duplicate property
let expctrl = fs.readFileSync('c:/bits/backend/src/modules/employees/employee-export.controller.ts', 'utf8');
// Check for duplicate EmployeeShift in select
const dupeCount = (expctrl.match(/EmployeeShift:/g) || []).length;
if (dupeCount > 1) {
    // Remove the first occurrence if duplicated, keep the more detailed one
    let found = false;
    expctrl = expctrl.replace(/EmployeeShift: \{[^}]*\{[^}]*\}[^}]*\},?\r?\n/m, (match) => {
        if (!found) { found = true; return ''; }
        return match;
    });
}
fs.writeFileSync('c:/bits/backend/src/modules/employees/employee-export.controller.ts', expctrl);
console.log(`Fixed employee-export.controller.ts: handled ${dupeCount} EmployeeShift occurrences`);

console.log('All fixes applied.');
