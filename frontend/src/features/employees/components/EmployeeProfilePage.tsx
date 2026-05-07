'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Building2, Clock,
  Fingerprint, CreditCard, Edit2, User, Briefcase, Hash, Shield,
  RadioTower, BadgeCheck
} from 'lucide-react'
import { useEmployeeProfile } from '../hooks/useEmployeeProfile'
import { Employee, formatFullName, formatTime, formatPhoneNumber } from '../utils/employee-types'
import { Avatar } from '@/components/ui/avatar'
import { EmployeeEditModal } from './EmployeeEditModal'
import { useEmployees } from '../hooks/useEmployees'
import { ProfilePictureUpload } from '@/features/employee-portal/components/ProfilePictureUpload'
import { employeesApi } from '@/lib/api'

interface EmployeeProfilePageProps {
  employeeId: number
  role: 'admin' | 'hr' | 'manager'
}

// ── Info Row helper ──────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, mono }: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className={`text-sm font-medium text-slate-700 mt-0.5 ${mono ? 'font-mono' : ''}`}>
          {value || <span className="text-slate-300 italic">—</span>}
        </p>
      </div>
    </div>
  )
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    STAGED: 'bg-blue-100 text-blue-700 border-blue-200',
    INACTIVE: 'bg-amber-100 text-amber-700 border-amber-200',
    TERMINATED: 'bg-rose-100 text-rose-700 border-rose-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${colors[status] || 'bg-slate-100 text-slate-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : status === 'STAGED' ? 'bg-blue-500' : status === 'INACTIVE' ? 'bg-amber-500' : 'bg-rose-500'}`} />
      {status}
    </span>
  )
}

export function EmployeeProfilePage({ employeeId, role }: EmployeeProfilePageProps) {
  const router = useRouter()
  const { employee, loading, error, refresh } = useEmployeeProfile(employeeId)
  const { departments, branches, shifts, companies } = useEmployees()

  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState<Partial<Employee>>({})
  const [isSaving, setIsSaving] = useState(false)

  const basePath = role === 'hr' ? '/hr/employees' : role === 'manager' ? '/manager/employees' : '/employees'

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-pulse space-y-6">
        <div className="h-6 bg-slate-200 rounded w-32" />
        <div className="h-48 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 rounded-2xl" />
          <div className="h-64 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error || !employee) {
    return (
      <div className="max-w-5xl mx-auto">
        <button onClick={() => router.push(basePath)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Employees
        </button>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <p className="text-red-600 font-bold">{error || 'Employee not found'}</p>
        </div>
      </div>
    )
  }

  const fullName = formatFullName(employee.firstName, employee.middleName, employee.lastName, employee.suffix)
  const initials = `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.trim()

  const handleEdit = () => {
    setEditingEmployee(employee)
    setEditForm({ ...employee })
  }

  const handleSave = async () => {
    if (!editingEmployee) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (data.success) {
        setEditingEmployee(null)
        refresh()
      }
    } catch {
      // handled silently
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Back Navigation ─────────────────────────────────────────────── */}
      <Link
        href={basePath}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Employees
      </Link>

      {/* ── Header Card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-red-500 via-red-600 to-red-700" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <ProfilePictureUpload
              currentUrl={employee.profilePicture || null}
              initials={initials}
              readonly={role === 'manager'}
              onUpload={async (file) => {
                const res = await employeesApi.uploadProfilePicture(employee.id, file)
                if (res.success) {
                  refresh()
                }
              }}
              onDelete={async () => {
                const res = await employeesApi.deleteProfilePicture(employee.id)
                if (res.success) {
                  refresh()
                }
              }}
            />
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{fullName}</h1>
                <StatusBadge status={employee.employmentStatus} />
              </div>
              <p className="text-slate-500 text-sm mt-1">{employee.position || 'Employee'}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-3 text-xs text-slate-400">
                {employee.Department?.name && (
                  <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {employee.Department.name}</span>
                )}
                {employee.Branch?.name && (
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {employee.Branch.name}</span>
                )}
                {employee.Shift?.name && (
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {employee.Shift.name}</span>
                )}
              </div>
            </div>
            {role !== 'manager' && (
              <button
                onClick={handleEdit}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Personal Information ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-blue-500" />
          <div className="p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-500" /> Personal Information
            </h3>
            <InfoRow icon={Mail} label="Email" value={employee.email} />
            <InfoRow icon={Phone} label="Contact Number" value={employee.contactNumber ? formatPhoneNumber(employee.contactNumber) : null} />
            <InfoRow icon={User} label="Gender" value={employee.gender ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1).toLowerCase() : null} />
            <InfoRow icon={Calendar} label="Date of Birth" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null} />
            <InfoRow icon={Calendar} label="Hire Date" value={employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null} />
          </div>
        </div>

        {/* ── Employment Details ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-indigo-500" />
          <div className="p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-500" /> Employment Details
            </h3>
            <InfoRow icon={Hash} label="Employee Number" value={employee.employeeNumber} mono />
            <InfoRow icon={Hash} label="ZK ID (Biometric)" value={employee.zkId} mono />
            <InfoRow icon={Building2} label="Department" value={employee.Department?.name} />
            <InfoRow icon={MapPin} label="Branch" value={employee.Branch?.name} />
            <InfoRow icon={Shield} label="Role" value={employee.role} />
          </div>
        </div>

        {/* ── Shift Schedule ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-amber-500" />
          <div className="p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> Shift Schedule
            </h3>
            {employee.Shift ? (
              <>
                <InfoRow icon={Clock} label="Shift Name" value={employee.Shift.name} />
                <InfoRow icon={Hash} label="Shift Code" value={employee.Shift.shiftCode} mono />
                <InfoRow icon={Clock} label="Schedule" value={`${formatTime(employee.Shift.startTime)} — ${formatTime(employee.Shift.endTime)}`} />
                {employee.Shift.graceMinutes !== undefined && (
                  <InfoRow icon={Clock} label="Grace Period" value={`${employee.Shift.graceMinutes} minutes`} />
                )}
                {employee.Shift.isNightShift && (
                  <InfoRow icon={Clock} label="Night Shift" value="Yes" />
                )}
              </>
            ) : (
              <div className="py-8 text-center">
                <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">No shift assigned</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Biometric & Device Enrollment ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-emerald-500" />
          <div className="p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-emerald-500" /> Biometric & Devices
            </h3>

            {/* RFID Badge */}
            <InfoRow icon={CreditCard} label="RFID Badge Number" value={employee.cardNumber ? `#${employee.cardNumber}` : null} mono />

            {/* Device Enrollments */}
            <div className="py-3 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <RadioTower className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enrolled Devices</p>
                  {employee.EmployeeDeviceEnrollment && employee.EmployeeDeviceEnrollment.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {employee.EmployeeDeviceEnrollment.map((enrollment, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all ${
                            enrollment.device.isActive
                              ? 'bg-green-500/10 text-green-600 border-green-500/20'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${enrollment.device.isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                          {enrollment.device.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300 italic mt-1">Not enrolled on any device</p>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Metadata Footer ─────────────────────────────────────────────── */}
      <div className="text-center text-xs text-slate-300 pb-4">
        Created {new Date(employee.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        {employee.updatedAt && ` · Last updated ${new Date(employee.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
      </div>

      {/* ── Edit Modal (reuses existing) ─────────────────────────────── */}
      {editingEmployee && (
        <EmployeeEditModal
          employee={editingEmployee}
          editForm={editForm}
          departments={departments}
          branches={branches}
          companies={companies}
          shifts={shifts}
          isSaving={isSaving}
          onFormChange={setEditForm}
          onSave={handleSave}
          onClose={() => setEditingEmployee(null)}
          onDuplicateBlur={() => {}}
        />
      )}
    </div>
  )
}
