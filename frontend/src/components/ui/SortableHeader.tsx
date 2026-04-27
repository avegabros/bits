import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  currentSortOrder: 'asc' | 'desc' | null;
  onSort: (key: any) => void;
  className?: string; // Optional custom tailwind classes
}

export const SortableHeader = ({ 
  label, 
  sortKey, 
  currentSortKey, 
  currentSortOrder, 
  onSort,
  className = "px-4 py-4"
}: SortableHeaderProps) => {
  const isActive = currentSortKey === sortKey;

  const isCentered = className?.includes('text-center');

  return (
    <th 
      className={`${className} cursor-pointer group hover:bg-slate-100 transition-colors select-none`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1.5 w-fit ${isCentered ? 'mx-auto' : ''}`}>
        <span>{label}</span>
        <span className="text-slate-400 opacity-50 group-hover:opacity-100 transition-opacity">
          {isActive && currentSortOrder === 'asc' && <ChevronUp className="w-4 h-4 text-slate-700" />}
          {isActive && currentSortOrder === 'desc' && <ChevronDown className="w-4 h-4 text-slate-700" />}
          {(!isActive || !currentSortOrder) && <ChevronsUpDown className="w-4 h-4" />}
        </span>
      </div>
    </th>
  );
};
