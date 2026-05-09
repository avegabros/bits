const fs = require('fs');
const path = require('path');
const file = path.join('c:/bits/backend/src/modules/attendance/attendance.service.ts');
let content = fs.readFileSync(file, 'utf8');

// Update autoCloseIncompleteAttendance and repairMissingCheckouts queries
content = content.replace(
    /include: \{ employee: \{ include: \{ Shift: true \} \} \}/g,
    `include: { employee: { include: { Shift: true } }, shift: true }`
);

// Update autoCloseIncompleteAttendance shift reference
content = content.replace(
    /const shift = record\.employee\?\.Shift;/g,
    `const shift = record.shift ?? record.employee?.Shift;`
);

// Update autoCheckoutEmployees shift reference
content = content.replace(
    /const shift = record\.employee\?\.Shift \?\? null;/g,
    `const shift = record.shift ?? record.employee?.Shift ?? null;`
);

// Update getAttendanceRecords query
content = content.replace(
    /include: \{ employee: \{ include: \{ Department: \{ select: \{ name: true \} \}, Branch: \{ select: \{ name: true \} \}, Shift: true \} \}, checkInDevice: \{ select: \{ name: true \} \}, checkOutDevice: \{ select: \{ name: true \} \} \}/g,
    `include: { employee: { include: { Department: { select: { name: true } }, Branch: { select: { name: true } }, Shift: true } }, shift: { select: { id: true, name: true, shiftCode: true, startTime: true, endTime: true, isNightShift: true } }, checkInDevice: { select: { name: true } }, checkOutDevice: { select: { name: true } } }`
);

// Update getAttendanceRecords response mapping
content = content.replace(
    /shiftCode: shift\?\.shiftCode \|\| null,/g,
    `shiftId: record.shiftId,
                shiftName: shift?.name || null,
                shiftCode: shift?.shiftCode || null,`
);

fs.writeFileSync(file, content);
console.log('Phase 2b patched successfully.');
