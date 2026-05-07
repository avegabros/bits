'use client';

import { EmployeeListPage } from '@/features/employees/components/EmployeeListPage';

export default function AdminEmployeesPage() {
  return (
    <div className="w-full">
      <EmployeeListPage role="admin" statusFilter="Active" />
    </div>
  );
}