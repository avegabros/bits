'use client';

import { EmployeeListPage } from '@/features/employees/components/EmployeeListPage';

export default function ManagerEmployeesPage() {
  return (
    <div className="w-full">
      <EmployeeListPage role="manager" statusFilter="Active" />
    </div>
  );
}
