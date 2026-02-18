'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  UserCog,
  Shield,
  ChevronLeft,
  ChevronRight,
  Mail,
  Eye,
  EyeOff
} from 'lucide-react'

interface UserAccount {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
  status: 'active' | 'inactive'
  createdAt: string
}

export default function UserAccountsPage() {
  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  // Add / Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'ADMIN' as string,
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')

  // Fetch users from backend
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
        return
      }

      const data = await res.json()
      if (data.success) {
        setUsers(data.users)
      } else {
        console.error('Failed to fetch users:', data.message)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = users.filter(u => {
    const matchesSearch = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role.toLowerCase() === roleFilter
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter
    return matchesSearch && matchesRole && matchesStatus
  })

  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage) || 1
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  // Stats
  const totalUsers = users.length
  const adminCount = users.filter(u => u.role === 'ADMIN').length
  const hrCount = users.filter(u => u.role === 'HR').length
  const activeCount = users.filter(u => u.status === 'active').length

  const openAddDialog = () => {
    setEditingUser(null)
    setFormData({ firstName: '', lastName: '', email: '', role: 'ADMIN', password: '', confirmPassword: '' })
    setFormError('')
    setIsDialogOpen(true)
  }

  const openEditDialog = (user: UserAccount) => {
    setEditingUser(user)
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      password: '',
      confirmPassword: '',
    })
    setFormError('')
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    setFormError('')
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setFormError('First name, last name, and email are required')
      return
    }
    if (!editingUser && (!formData.password || formData.password.length < 8)) {
      setFormError('Password must be at least 8 characters')
      return
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'

      const body: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        role: formData.role,
      }
      if (formData.password) {
        body.password = formData.password
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      const data = await res.json()
      if (data.success) {
        await fetchUsers()
        setIsDialogOpen(false)
      } else {
        setFormError(data.message || 'Failed to save user')
      }
    } catch (error) {
      console.error('Error saving user:', error)
      setFormError('Failed to save user')
    }
  }

  const toggleStatus = async (id: number) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/users/${id}/toggle-status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        await fetchUsers()
      } else {
        alert(data.message || 'Failed to toggle status')
      }
    } catch (error) {
      console.error('Error toggling status:', error)
    }
  }

  const deleteUser = async (id: number) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        await fetchUsers()
      } else {
        alert(data.message || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">User Accounts</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage admin and HR user accounts</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-md mx-4">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-foreground text-sm">First Name</Label>
                  <Input
                    placeholder="First name"
                    className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    value={formData.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-foreground text-sm">Last Name</Label>
                  <Input
                    placeholder="Last name"
                    className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    value={formData.lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-foreground text-sm">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="user@avega.com"
                    className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-foreground text-sm">Role</Label>
                <Select value={formData.role} onValueChange={(v: string) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger className="mt-1 bg-secondary border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="ADMIN">Administrator</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-foreground text-sm">{editingUser ? 'New Password (leave blank to keep)' : 'Password'}</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={editingUser ? 'Leave blank to keep current' : 'Min. 8 characters'}
                    className="pr-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    value={formData.password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-foreground text-sm">Confirm Password</Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  value={formData.confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
              </div>

              {formError && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-border text-foreground hover:bg-secondary">Cancel</Button>
                <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
                  {editingUser ? 'Save Changes' : 'Create User'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-card border-border p-4 sm:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Total Users</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{totalUsers}</p>
              <p className="text-xs text-green-400 mt-1">{activeCount} active</p>
            </div>
            <div className="bg-primary/20 p-2 sm:p-3 rounded-lg">
              <UserCog className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border p-4 sm:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Admins</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{adminCount}</p>
            </div>
            <div className="bg-blue-500/20 p-2 sm:p-3 rounded-lg">
              <Shield className="w-4 h-4 sm:w-6 sm:h-6 text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border p-4 sm:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">HR Users</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{hrCount}</p>
            </div>
            <div className="bg-green-500/20 p-2 sm:p-3 rounded-lg">
              <UserCog className="w-4 h-4 sm:w-6 sm:h-6 text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="bg-card border-border p-4 sm:p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs sm:text-sm font-medium">Active Rate</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1 sm:mt-2">{totalUsers > 0 ? Math.round((activeCount / totalUsers) * 100) : 0}%</p>
            </div>
            <div className="bg-yellow-500/20 p-2 sm:p-3 rounded-lg">
              <Shield className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="bg-card border-border p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name or email..."
              className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            />
          </div>
          <Select value={roleFilter} onValueChange={(v: string) => { setRoleFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-full sm:w-40 bg-secondary border-border text-foreground">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v: string) => { setStatusFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-full sm:w-40 bg-secondary border-border text-foreground">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border overflow-hidden rounded-2xl shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Role</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Status</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Created</th>
                <th className="px-4 sm:px-6 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Loading users...</td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No users found</td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => (
                  <tr key={user.id} className={`hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-secondary/10'}`}>
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${user.role === 'ADMIN' ? 'bg-blue-500' : 'bg-green-500'}`}>
                          {user.firstName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{user.firstName} {user.lastName}</p>
                          <p className="text-xs text-muted-foreground md:hidden truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">{user.email}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-3">
                      <Badge
                        variant="outline"
                        className={user.role === 'ADMIN'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs'
                          : 'bg-green-500/20 text-green-400 border-green-500/30 text-xs'
                        }
                      >
                        {user.role === 'ADMIN' ? 'Admin' : 'HR'}
                      </Badge>
                    </td>
                    <td className="px-4 sm:px-6 py-3 hidden sm:table-cell">
                      <button onClick={() => toggleStatus(user.id)}>
                        <Badge
                          variant="outline"
                          className={`cursor-pointer ${user.status === 'active'
                            ? 'bg-green-500/20 text-green-400 border-green-500/30 text-xs'
                            : 'bg-red-500/20 text-red-400 border-red-500/30 text-xs'
                            }`}
                        >
                          {user.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 sm:px-6 py-3 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground font-mono">
                        {new Date(user.createdAt).toLocaleDateString('en-CA')}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8 p-0"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                          onClick={() => deleteUser(user.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 sm:px-6 py-3 border-t border-border bg-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Showing {filteredUsers.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0} to {Math.min(currentPage * rowsPerPage, filteredUsers.length)} of {filteredUsers.length} users
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-foreground font-medium px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
