import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { DataTablePagination } from '@/components/ui/DataTablePagination';
import { ReportRow } from '@/types/reports';
import { formatHrsMins, formatShiftTime, formatLateHrs } from '@/features/reports/lib/formatters';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { Skeleton } from '@/components/ui/Skeleton';

interface ReportTableProps {
  variant?: 'admin' | 'hr';
  paginatedData: ReportRow[];
  filteredDataLength: number;
  loading: boolean;
  currentPage: number;
  totalPages: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setSelectedEmployee: (emp: ReportRow) => void;
  sortKey: string | null;
  sortOrder: 'asc' | 'desc';
  handleSort: (key: keyof ReportRow) => void;
}

export const ReportTable: React.FC<ReportTableProps> = ({
  variant = 'admin',
  paginatedData,
  filteredDataLength,
  loading,
  currentPage,
  totalPages,
  setCurrentPage,
  setSelectedEmployee,
  sortKey,
  sortOrder,
  handleSort,
}) => {
  const dragScrollRef = useHorizontalDragScroll();

  // Variant-specific styling
  const tableContainerClass = variant === 'hr'
    ? "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" 
    : "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden";


  return (
    <div className={tableContainerClass}>
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">
          Preview Records
        </h3>
      </div>

      <div
        ref={dragScrollRef}
        className="overflow-x-auto scrollbar-table"
        tabIndex={0}
        role="region"
        aria-label="Report records table — scroll horizontally"
      >
        <table className="w-full text-left text-sm min-w-[900px]">
          <thead className="text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr>
              <SortableHeader label="Employee" sortKey="name" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-6 py-4" />
              <th className="px-6 py-4">Shift</th>
              <SortableHeader label="Present" sortKey="present" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-6 py-4 text-center" />
              <SortableHeader label="Late" sortKey="lateMinutes" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-6 py-4 text-center" />
              <SortableHeader label="Overtime" sortKey="overtime" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-6 py-4 text-center" />
              <SortableHeader label="Undertime" sortKey="undertime" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-6 py-4 text-center" />
              <SortableHeader label="Reg Hrs" sortKey="totalHours" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="px-6 py-4 text-center" />
              <th className="px-6 py-4 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <>
                {[...Array(6)].map((_, i) => (
                  <Skeleton.TableRow key={i} cols={8} />
                ))}
              </>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                  No records found
                </td>
              </tr>
            ) : (
              paginatedData.map((employee) => (
                <tr
                  key={employee.id}
                  className="hover:bg-red-50/30 transition-colors duration-200"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">
                        {employee.name}
                      </span>
                      {employee.hasAnomaly && (
                        <span title="This employee has anomalous check-in records">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        </span>
                      )}
                      {employee.hasMissingCheckout && (
                        <span title="This employee has missing check-outs (incomplete records)">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {employee.shift ? (
                      <div>
                        <p className="text-xs font-bold text-slate-700">
                          {employee.shift.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {formatShiftTime(employee.shift.startTime)} –{' '}
                          {formatShiftTime(employee.shift.endTime)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300 font-bold italic">
                        No shift
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="text-sm font-bold text-slate-700">
                      {employee.present}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {employee.lateMinutes > 0 ? (
                      <span className="text-sm font-bold text-yellow-600">
                        {formatLateHrs(employee.lateMinutes)}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span
                      className={`text-sm font-bold ${
                        employee.overtime > 0 ? 'text-blue-600' : 'text-slate-300'
                      }`}
                    >
                      {employee.overtime > 0
                        ? formatHrsMins(employee.overtime)
                        : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span
                      className={`text-sm font-bold ${
                        employee.undertime > 0 ? 'text-red-500' : 'text-slate-300'
                      }`}
                    >
                      {employee.undertime > 0
                        ? formatHrsMins(employee.undertime)
                        : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="text-sm font-bold font-mono text-slate-800">
                      {Math.max(0, employee.totalHours - employee.overtime).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <button
                      onClick={() => setSelectedEmployee(employee)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-full transition-colors shadow-sm"
                    >
                      View History
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <DataTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalCount={filteredDataLength}
        pageSize={10}
        entityName="records"
        loading={loading}
      />
    </div>
  );
};
