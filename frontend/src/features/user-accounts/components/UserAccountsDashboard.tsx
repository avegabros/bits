'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserCog, Plus, Search } from 'lucide-react'
import ToastContainer from '@/components/ui/ToastContainer'
import { useTableSort } from '@/hooks/useTableSort'
import { useAuth } from '@/hooks/useAuth'

import { useUserAccounts } from '../hooks/useUserAccounts'
import { UserAccount } from '../utils/user-types'
import { UserAccountStats } from './UserAccountStats'
import { UserAccountTable } from './UserAccountTable'
import { UserAccountAddEditModal } from './UserAccountAddEditModal'
import { UserAccountStatusConfirm } from './UserAccountStatusConfirm'

export function UserAccountsDashboard() {
  const { employee } = useAuth(['ADMIN', 'MANAGER'])
  const currentUserRole = employee?.role ?? 'ADMIN'
  const { users, loading, fetchUsers, saveUser, toggleStatus, toasts, dismissToast } = useUserAccounts()

  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  
  const [statusConfirm, setStatusConfirm] = useState<{
    open: boolean
    userId: number | null
    userName: string
    currentStatus: string
  }>({ open: false, userId: null, userName: '', currentStatus: '' })

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const filteredUsers = users.filter(u => {
    const matchesSearch = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role.toLowerCase() === roleFilter
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const { sortedData: sortedUsers, sortKey, sortOrder, handleSort } = useTableSort<UserAccount>({
    initialData: filteredUsers
  })

  // Pagination logic
  const totalPages = Math.ceil(sortedUsers.length / rowsPerPage) || 1
  const paginatedUsers = sortedUsers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const handleOpenAdd = () => {
    setEditingUser(null)
    setIsAddEditOpen(true)
  }

  const handleOpenEdit = (user: UserAccount) => {
    setEditingUser(user)
    setIsAddEditOpen(true)
  }

  const handleOpenToggleStatus = (user: UserAccount) => {
    setStatusConfirm({
      open: true,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      currentStatus: user.status,
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center">
            <UserCog className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">User Accounts</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Manage admin and HR user accounts</p>
          </div>
        </div>
        <Button 
          onClick={handleOpenAdd} 
          className="bg-red-600 hover:bg-red-700 gap-2 text-white shadow-lg shadow-red-600/20 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      <UserAccountStats users={users} />

      {/* Filter Bar */}
      <Card className="bg-white border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search by name or email..."
              className="pl-10 bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-full sm:w-40 bg-slate-50 border-slate-200 text-slate-700">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-full sm:w-40 bg-slate-50 border-slate-200 text-slate-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <UserAccountTable
        loading={loading}
        filteredUsersLength={filteredUsers.length}
        paginatedUsers={paginatedUsers}
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
        sortKey={sortKey as string | null}
        sortOrder={sortOrder as 'asc' | 'desc'}
        handleSort={handleSort as any}
        onEdit={handleOpenEdit}
        onToggleStatus={handleOpenToggleStatus}
        currentUserRole={currentUserRole}
      />

      <UserAccountAddEditModal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        editingUser={editingUser}
        onSave={saveUser}
        currentUserRole={currentUserRole}
      />

      <UserAccountStatusConfirm
        isOpen={statusConfirm.open}
        onClose={() => setStatusConfirm({ ...statusConfirm, open: false })}
        userId={statusConfirm.userId}
        userName={statusConfirm.userName}
        currentStatus={statusConfirm.currentStatus}
        onConfirm={toggleStatus}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
