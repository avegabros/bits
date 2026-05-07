'use client';

import React from 'react';
import { GitBranch, MapPin } from 'lucide-react';

interface BranchTabsProps {
  activeBranchId: string;
  onBranchChange: (branchName: string) => void;
  branches: string[]; // These are branch names
}

export function BranchTabs({
  activeBranchId,
  onBranchChange,
  branches,
}: BranchTabsProps) {
  // branches list from hook includes "All Branches"
  return (
    <div className="flex items-end gap-1 overflow-x-auto scrollbar-none pb-px">
      {branches.map((branchName) => {
        const isActive = activeBranchId === branchName;
        const Icon = branchName === 'All Branches' ? GitBranch : MapPin;

        return (
          <button
            key={branchName}
            onClick={() => onBranchChange(branchName)}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-t-xl text-xs font-black uppercase tracking-widest transition-all duration-200 border-b-2 whitespace-nowrap
              ${
                isActive
                  ? 'bg-card border-b-transparent text-primary shadow-sm border border-border border-b-card'
                  : 'bg-secondary/40 border-b-transparent text-muted-foreground hover:bg-secondary'
              }
            `}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            {branchName}
          </button>
        );
      })}
    </div>
  );
}
