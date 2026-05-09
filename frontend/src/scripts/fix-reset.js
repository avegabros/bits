const fs = require('fs');
const f = 'c:/bits/frontend/src/features/employees/components/EmployeeAddModal.tsx';
let c = fs.readFileSync(f, 'utf8');

// Add shiftIds: [] to ALL setNewEmployee({...}) calls that are missing it
c = c.replace(
  /shiftId: '', gender: '', dateOfBirth: ''\r?\n(\s*)\}\)/g,
  "shiftId: '', gender: '', dateOfBirth: '', shiftIds: []\n$1})"
);

fs.writeFileSync(f, c);
console.log('Fixed all setNewEmployee calls to include shiftIds');
