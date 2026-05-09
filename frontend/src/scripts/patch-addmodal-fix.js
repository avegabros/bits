const fs = require('fs');
const file = 'c:/bits/frontend/src/features/employees/components/EmployeeAddModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add lucide imports (handle both import forms)
if (!content.includes('ArrowUp')) {
  content = content.replace(
    /import \{ Loader2, Plus, X as XIcon \} from 'lucide-react';/,
    "import { Loader2, Plus, X as XIcon, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';"
  );
}

// Add shiftIds to state - handle CRLF
content = content.replace(
  /shiftId: '', gender: '', dateOfBirth: ''\r?\n\s*\}\);/,
  (match) => {
    // Check if it's inside useState (first occurrence) or reset (second)
    return match.replace(
      /shiftId: '', gender: '', dateOfBirth: ''/,
      "shiftId: '', gender: '', dateOfBirth: '', shiftIds: [] as number[]"
    );
  }
);

// Handle the reset state too (second occurrence is typically in reset function)
// But only if first replacement happened at useState

// Add shiftIds to validation
if (!content.includes('shiftIds: newEmployee.shiftIds')) {
  content = content.replace(
    /shiftId: newEmployee\.shiftId \? parseInt\(newEmployee\.shiftId\) : undefined,?\r?\n/,
    "shiftId: newEmployee.shiftId ? parseInt(newEmployee.shiftId) : undefined,\n      shiftIds: newEmployee.shiftIds,\n"
  );
}

// Replace single shift select with multi-shift picker
const oldShiftPattern = /<div><label className="text-slate-400 text-\[10px\] uppercase font-bold">Work Shift<\/label><select className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none" value=\{newEmployee\.shiftId\} onChange=\{e => setNewEmployee\(p => \(\{ \.\.\.p, shiftId: e\.target\.value \}\)\)\}><option value="">No shift assigned<\/option>\{shifts\.map\(s => <option key=\{s\.id\} value=\{s\.id\}>\[\{s\.shiftCode\}\] \{s\.name\}<\/option>\)\}<\/select><\/div>/;

if (oldShiftPattern.test(content)) {
  content = content.replace(oldShiftPattern, `<div>
              <label className="text-slate-400 text-[10px] uppercase font-bold">Work Shifts</label>
              <div className="mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-2">
                {newEmployee.shiftIds && newEmployee.shiftIds.length > 0 ? (
                  newEmployee.shiftIds.map((sid: number, index: number) => {
                    const shift = shifts.find((s: any) => s.id === sid);
                    if (!shift) return null;
                    return (
                      <div key={sid} className="flex items-center gap-2 bg-white p-2 rounded border border-slate-100 shadow-sm group">
                        <div className="flex flex-col gap-0.5">
                          <button type="button" onClick={() => {
                              if (index === 0) return;
                              const newIds = [...newEmployee.shiftIds];
                              [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
                              setNewEmployee(p => ({ ...p, shiftIds: newIds }));
                          }} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" disabled={index === 0}>
                              <ArrowUp size={10} />
                          </button>
                          <button type="button" onClick={() => {
                              if (index === newEmployee.shiftIds.length - 1) return;
                              const newIds = [...newEmployee.shiftIds];
                              [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
                              setNewEmployee(p => ({ ...p, shiftIds: newIds }));
                          }} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" disabled={index === newEmployee.shiftIds.length - 1}>
                              <ArrowDown size={10} />
                          </button>
                        </div>
                        <div className="flex-1 ml-1 text-xs text-slate-700">[{shift.shiftCode}]</div>
                        <button type="button" onClick={() => {
                          setNewEmployee(p => ({ ...p, shiftIds: p.shiftIds.filter((id: number) => id !== sid) }));
                        }} className="text-slate-400 hover:text-red-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <XIcon size={12} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-2 text-[10px] text-slate-400">No shifts</div>
                )}
                <select
                  value=""
                  onChange={e => {
                    const sid = parseInt(e.target.value);
                    if (sid && !(newEmployee.shiftIds || []).includes(sid)) {
                      setNewEmployee(p => ({ ...p, shiftIds: [...(p.shiftIds || []), sid] }));
                    }
                  }}
                  className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs outline-none bg-white"
                >
                  <option value="">+ Add Shift</option>
                  {shifts.filter((s: any) => !(newEmployee.shiftIds || []).includes(s.id)).map((s: any) => (
                    <option key={s.id} value={s.id}>[{s.shiftCode}] {s.name}</option>
                  ))}
                </select>
              </div>
            </div>`);
  console.log('Replaced single shift select with multi-shift picker');
} else {
  console.log('Single shift select pattern not found (may already be patched)');
}

fs.writeFileSync(file, content);
console.log('Successfully patched EmployeeAddModal.tsx');
