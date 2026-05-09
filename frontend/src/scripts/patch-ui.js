const fs = require('fs');
const path = require('path');
const file = path.join('c:/bits/frontend/src/features/employees/components/EditAssignmentSection.tsx');
let content = fs.readFileSync(file, 'utf8');

// Add lucide imports
content = content.replace(
  "import React, { useState, useMemo, useEffect } from 'react'",
  "import React, { useState, useMemo, useEffect } from 'react'\nimport { GripVertical, X, ArrowUp, ArrowDown } from 'lucide-react'"
);

// Replace Work Shift
const oldShiftCode = `      {/* Work Shift */}
      <div className="space-y-1">
        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Work Shift</label>
        <select
          value={(editForm as any).shiftId || ''}
          onChange={(e) => onFormChange({ ...editForm, shiftId: e.target.value ? parseInt(e.target.value) : null } as any)}
          className={\`\${inputBase} \${inputNormal}\`}
        >
          <option value="">No shift assigned</option>
          {shifts.map(s => (
            <option key={s.id} value={s.id}>
              [{s.shiftCode}] {s.name} ({formatTime(s.startTime)} – {formatTime(s.endTime)})
            </option>
          ))}
        </select>
      </div>`;

const newShiftCode = `      {/* Work Shifts */}
      <div className="space-y-2">
        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
          <span>Work Shifts</span>
        </label>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-2">
          {((editForm as any).shiftIds || []).length > 0 ? (
            ((editForm as any).shiftIds as number[]).map((sid, index) => {
              const shift = shifts.find(s => s.id === sid);
              if (!shift) return null;
              return (
                <div key={sid} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100 shadow-sm group">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => {
                        if (index === 0) return;
                        const newIds = [...((editForm as any).shiftIds as number[])];
                        [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
                        onFormChange({ ...editForm, shiftIds: newIds } as any);
                    }} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" disabled={index === 0}>
                        <ArrowUp size={12} />
                    </button>
                    <button type="button" onClick={() => {
                        if (index === ((editForm as any).shiftIds as number[]).length - 1) return;
                        const newIds = [...((editForm as any).shiftIds as number[])];
                        [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
                        onFormChange({ ...editForm, shiftIds: newIds } as any);
                    }} className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed" disabled={index === ((editForm as any).shiftIds as number[]).length - 1}>
                        <ArrowDown size={12} />
                    </button>
                  </div>
                  <div className="flex-1 ml-1">
                    <div className="text-xs font-bold text-slate-700">[{shift.shiftCode}] {shift.name} {index === 0 && <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] uppercase tracking-wider font-bold">Primary</span>}</div>
                    <div className="text-[10px] text-slate-500">{formatTime(shift.startTime)} – {formatTime(shift.endTime)}</div>
                  </div>
                  <button type="button" onClick={() => {
                    const newIds = ((editForm as any).shiftIds as number[]).filter(id => id !== sid);
                    onFormChange({ ...editForm, shiftIds: newIds } as any);
                  }} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={14} />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center py-4 text-xs text-slate-400 font-medium">No shifts assigned</div>
          )}
          
          {/* Add Shift Dropdown */}
          <div className="pt-2 border-t border-slate-200 mt-2">
            <select
              value=""
              onChange={(e) => {
                const sid = parseInt(e.target.value);
                if (!sid) return;
                const currentIds = (editForm as any).shiftIds || [];
                if (!currentIds.includes(sid)) {
                  onFormChange({ ...editForm, shiftIds: [...currentIds, sid] } as any);
                }
              }}
              className={\`\${inputBase} \${inputNormal} bg-white text-xs\`}
            >
              <option value="">+ Add Shift</option>
              {shifts.filter(s => !((editForm as any).shiftIds || []).includes(s.id)).map(s => (
                <option key={s.id} value={s.id}>
                  [{s.shiftCode}] {s.name} ({formatTime(s.startTime)} – {formatTime(s.endTime)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>`;

content = content.replace(oldShiftCode, newShiftCode);
fs.writeFileSync(file, content);
console.log('Successfully patched EditAssignmentSection.tsx');
