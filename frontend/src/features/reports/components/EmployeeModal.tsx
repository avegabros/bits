import React from 'react';
import { ReportRow, AttendanceRecord } from '@/types/reports';
import { useEmployeeModalData } from '../hooks/useEmployeeModalData';
import { AdminDetailView } from './AdminDetailView';
import type { Holiday } from '@/features/holidays/hooks/useHolidays';

interface EmployeeModalProps {
  variant?: 'admin' | 'hr';
  exportSource?: 'admin-panel' | 'hr-panel';
  employee: ReportRow;
  records: AttendanceRecord[];
  startDate: string;
  endDate: string;
  holidays?: Holiday[];
  onClose: () => void;
  onExport: (employee: ReportRow, records: AttendanceRecord[], expSrc: 'admin-panel' | 'hr-panel') => void;
}

export const EmployeeModal: React.FC<EmployeeModalProps> = ({
  variant = 'admin',
  exportSource = 'admin-panel',
  employee,
  records,
  startDate,
  endDate,
  holidays,
  onClose,
  onExport,
}) => {
  const {
    attendanceRate,
    hrTableRows,
    sortedData,
    sortKeyStr,
    sortOrder,
    handleSort,
    logSearchDate,
    setLogSearchDate,
    logDateRef,
  } = useEmployeeModalData(employee, records, startDate, endDate, holidays);

  return (
    <AdminDetailView
      employee={employee}
      records={records}
      startDate={startDate}
      endDate={endDate}
      exportSource={exportSource}
      attendanceRate={attendanceRate}
      sortedData={sortedData}
      sortKeyStr={sortKeyStr}
      sortOrder={sortOrder}
      handleSort={handleSort}
      onClose={onClose}
      onExport={onExport}
    />
  );
};
