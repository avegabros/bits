const fs = require('fs');

const file = 'c:/bits/backend/src/modules/attendance/attendance.service.ts';
let content = fs.readFileSync(file, 'utf8');

// Fix 1: autoCheckoutEmployees - add shift: true to include
content = content.replace(
    /include: \{\r?\n\s*employee: \{\r?\n\s*include: \{ Shift: true \}\r?\n\s*\}\r?\n\s*\}\r?\n\s*\}\);/,
    (match) => {
        // Add shift: true after the employee include block
        return match.replace(
            'employee: {\r\n                    include: { Shift: true }\r\n                }',
            'employee: {\r\n                    include: { Shift: true }\r\n                },\r\n                shift: true'
        );
    }
);

// Fix 2: getAttendanceRecords - add shift: true to include  
// The query has checkInDevice, checkOutDevice, employee includes
content = content.replace(
    /checkOutDevice: \{ select: \{ name: true \} \},\r?\n\s*employee: \{/,
    'checkOutDevice: { select: { name: true } },\r\n                shift: true,\r\n                employee: {'
);

fs.writeFileSync(file, content);
console.log('Successfully added shift: true to attendance queries');
