'use client'

import { useParams } from 'next/navigation'
import { EmployeeProfilePage } from '@/features/employees/components/EmployeeProfilePage'

export default function ManagerEmployeeProfileRoute() {
  const params = useParams()
  const id = Number(params.id)

  if (!id || isNaN(id)) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center">
        <p className="text-red-500 font-bold">Invalid employee ID</p>
      </div>
    )
  }

  return <EmployeeProfilePage employeeId={id} role="manager" />
}
