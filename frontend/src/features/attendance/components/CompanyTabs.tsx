'use client';

import React from 'react';
import { Building2, Building } from 'lucide-react';

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
    <div className="flex items-end gap-1 overflow-x-auto scrollbar-none pb-px">
      {companies.map((companyName) => {
        const isActive = activeCompany === companyName;
        const Icon = companyName === 'All Companies' ? Building2 : Building;

        return (
          <button
            key={companyName}
            onClick={() => onCompanyChange(companyName)}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-t-xl text-xs font-black uppercase tracking-widest transition-all duration-200 border-b-2 whitespace-nowrap
              ${isActive
                ? 'bg-card border-b-transparent text-primary shadow-sm border border-border border-b-card'
                : 'bg-secondary/40 border-b-transparent text-muted-foreground hover:bg-secondary'
              }
            `}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            {companyName}
          </button>
        );
      })}
    </div>
  );
}
