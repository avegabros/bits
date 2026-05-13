'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { HorizontalScroller } from '@/components/ui/HorizontalScroller';

interface ShiftTabsProps {
  activeShift: string | null;
  onShiftChange: (shiftName: string) => void;
  shifts: string[];
}

export function ShiftTabs({
  activeShift,
  onShiftChange,
  shifts,
}: ShiftTabsProps) {
  if (!shifts || shifts.length === 0) return null;

  const currentShift = activeShift ?? 'All Shifts';

  return (
    <HorizontalScroller className="bg-secondary/30" innerClassName="flex items-end gap-1 pb-px px-6 pt-4">
      {shifts.map((shiftName) => {
        const isActive = currentShift === shiftName;

        return (
          <button
            key={shiftName}
            onClick={() => onShiftChange(shiftName === 'All Shifts' ? 'All Shifts' : shiftName)}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 border-b-2 whitespace-nowrap cursor-pointer max-w-[200px]
              ${isActive
                ? 'bg-white text-blue-600 shadow-sm border border-border border-b-white'
                : 'bg-secondary/40 border-b-transparent text-muted-foreground hover:bg-secondary'
              }
            `}
            title={shiftName}
          >
            <Clock className={`w-3 h-3 shrink-0 ${isActive ? 'text-blue-500' : 'text-muted-foreground'}`} />
            <span className="truncate">{shiftName}</span>
          </button>
        );
      })}
    </HorizontalScroller>
  );
}

