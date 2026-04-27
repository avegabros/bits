'use client'

import React, { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { useReportData } from '../hooks/useReportData';
import { useTableSort } from '@/hooks/useTableSort';
import { ReportFilters } from './ReportFilters';
import { ReportTable } from './ReportTable';
import { EmployeeModal } from './EmployeeModal';
import { handleExport, handleExportIndividual } from '../lib/exportReport';
import { formatDateShort } from '../lib/formatters';
import { ReportRow } from '@/types/reports';
import { useHolidays } from '@/features/holidays/hooks/useHolidays';

export function ReportsDashboard({ role = 'admin' }: { role?: 'admin' | 'hr' }) {
  // Use Asia/Manila for default dates to avoid shifting to previous day
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const phtNow = now.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Manila',
    });
    const [y, m] = phtNow.split('-');
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [selectedEmployee, setSelectedEmployee] = useState<ReportRow | null>(
    null
  );

  // Custom hook for data fetching & initial aggregation
  const { reportData, allRecords, loading, error } = useReportData(
    startDate,
    endDate
  );

  // Fetch holidays for the report date range so absent days on holidays
  // are displayed as "Holiday" instead of "Absent"
  const startYear = startDate ? parseInt(startDate.split('-')[0]) : new Date().getFullYear();
  const { holidays } = useHolidays({ year: startYear });

  // Derived filter options
  const departments = Array.from(
    new Set(reportData.map((e) => e.department).filter(Boolean))
  );
  const branches = Array.from(
    new Set(reportData.map((e) => e.branch).filter(Boolean))
  );

  // Apply UI filters
  const filteredData = reportData.filter((emp) => {
    const searchStr = searchTerm.toLowerCase().trim();
    const isNumericSearch = searchStr !== '' && !isNaN(Number(searchStr));

    const matchesSearch =
      !searchStr ||
      emp.name.toLowerCase().includes(searchStr) ||
      (emp.employeeNumber || '').toLowerCase().includes(searchStr) ||
      // Only compare zkId if the query is purely numeric (it's an Int)
      (isNumericSearch && emp.zkId === Number(searchStr));

    const matchesDept =
      selectedDept === 'all' || emp.department === selectedDept;
    const matchesBranch =
      selectedBranch === 'all' || emp.branch === selectedBranch;
    return matchesSearch && matchesDept && matchesBranch;
  });

  const { sortedData, sortKey, sortOrder, handleSort } = useTableSort<ReportRow>({
    initialData: filteredData
  });

  const totalPages = Math.ceil(sortedData.length / rowsPerPage) || 1;
  const paginatedData = sortedData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleFilterChange = () => setCurrentPage(1);

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 text-red-600 rounded-2xl border border-red-200">
        <h3 className="text-lg font-bold">Error Loading Reports</h3>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="">
      {/* Individual Employee Report Modal */}
      {selectedEmployee && (
        <EmployeeModal
          variant={role}
          exportSource={role === 'hr' ? 'hr-panel' : 'admin-panel'}
          employee={selectedEmployee}
          records={allRecords
            .filter((r) => r.employeeId === selectedEmployee.id)
            .sort(
              (a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            )}
          startDate={startDate}
          endDate={endDate}
          holidays={holidays}
          onClose={() => setSelectedEmployee(null)}
          onExport={(emp, recs, expSrc) =>
            handleExportIndividual(emp, startDate, endDate, recs, expSrc, holidays)
          }
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-red-600" />
            </div>
            <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-800">
                    Attendance Reports
                </h2>
                <p className="text-slate-400 text-sm mt-0.5">
                    Export overall attendance records
                </p>
            </div>
        </div>
        <button
          onClick={() => handleExport(filteredData, startDate, endDate, role === 'hr' ? 'hr-panel' : 'admin-panel')}
          className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-red-600/20 w-full sm:w-auto justify-center"
        >
          <Download className="w-4 h-4" />
          Attendance Report: {formatDateShort(startDate)} –{' '}
          {formatDateShort(endDate)}
        </button>
      </div>

      {/* Filter Bar */}
      <ReportFilters
        variant={role}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedBranch={selectedBranch}
        setSelectedBranch={setSelectedBranch}
        branches={branches}
        selectedDept={selectedDept}
        setSelectedDept={setSelectedDept}
        departments={departments}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onFilterChange={handleFilterChange}
      />

      {/* Preview Records Table */}
      <ReportTable
        variant={role}
        paginatedData={paginatedData}
        filteredDataLength={filteredData.length}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
        setSelectedEmployee={setSelectedEmployee}
        sortKey={sortKey as string | null}
        sortOrder={sortOrder as 'asc' | 'desc'}
        handleSort={handleSort as any}
      />
    </div>
  );
}
