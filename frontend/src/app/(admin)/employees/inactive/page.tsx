'use client';

import { EmployeeListPage } from '@/features/employees/components/EmployeeListPage';

export default function AdminInactiveEmployeesPage() {
  return (
    <div className="w-full">
      <EmployeeListPage role="admin" statusFilter="Inactive" />
    </div>
  );
}
