'use client';

import { EmployeeListPage } from '@/features/employees/components/EmployeeListPage';

export default function HrEmployeesPage() {
  return (
    <div className="w-full">
      <EmployeeListPage role="hr" statusFilter="Active" />
    </div>
  );
}