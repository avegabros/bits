'use client';

import { EmployeeListPage } from '@/features/employees/components/EmployeeListPage';

export default function HrInactiveEmployeesPage() {
  return (
    <div className="w-full">
      <EmployeeListPage role="hr" statusFilter="Inactive" />
    </div>
  );
}