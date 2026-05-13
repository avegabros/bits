'use client';

import React from 'react';
import { Building2, Building } from 'lucide-react';
import { HorizontalScroller } from '@/components/ui/HorizontalScroller';

interface CompanyTabsProps {
  activeCompany: string;
  onCompanyChange: (companyName: string) => void;
  companies: string[];
}

export function CompanyTabs({
  activeCompany,
  onCompanyChange,
  companies,
}: CompanyTabsProps) {
  return (
    <HorizontalScroller innerClassName="flex items-end gap-1 pb-px">
      {companies.map((companyName) => {
        const isActive = activeCompany === companyName;
        const Icon = companyName === 'All Companies' ? Building2 : Building;

        return (
          <button
            key={companyName}
            onClick={() => onCompanyChange(companyName)}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-t-xl text-xs font-black uppercase tracking-widest transition-all duration-200 border-b-2 whitespace-nowrap cursor-pointer max-w-[240px]
              ${isActive
                ? 'bg-card text-primary shadow-sm border border-border border-b-card'
                : 'bg-secondary/40 border-b-transparent text-muted-foreground hover:bg-secondary'
              }
            `}
            title={companyName}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="truncate">{companyName}</span>
          </button>
        );
      })}
    </HorizontalScroller>
  );
}

