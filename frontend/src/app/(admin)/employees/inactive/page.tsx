'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Trash2, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, UserX } from 'lucide-react'

type Employee = {
  id: number
  firstName: string
  lastName: string
  email: string | null
  department: string | null
  position: string | null
  branch: string | null
  contactNumber: string | null
  hireDate: string | null
  employmentStatus: 'ACTIVE' | 'INACTIVE' | 'TERMINATED'
  createdAt: string
}

export default function InactiveEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  // Confirm restore dialog
  const [confirmRestore, setConfirmRestore] = useState<Employee | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  // Confirm permanent delete dialog
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchInactiveEmployees = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/employees', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
        return
      }
      const data = await res.json()
      if (data.success) {
        setEmployees(data.employees.filter((e: Employee) => e.employmentStatus === 'INACTIVE'))
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInactiveEmployees()
  }, [])

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase()
    return fullName.includes(searchTerm.toLowerCase()) ||
      (emp.contactNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  })

  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage)
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const handleRestore = async () => {
    if (!confirmRestore) return
    setIsRestoring(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/employees/${confirmRestore.id}/reactivate`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        await fetchInactiveEmployees()
        setConfirmRestore(null)
      } else {
        alert('Failed to restore employee: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error restoring employee:', error)
      alert('Failed to restore employee')
    } finally {
      setIsRestoring(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (!confirmDelete) return
    setIsDeleting(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/employees/${confirmDelete.id}/permanent`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        await fetchInactiveEmployees()
        setConfirmDelete(null)
      } else {
        alert('Failed to delete employee: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error deleting employee:', error)
      alert('Failed to delete employee')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Confirm Restore Dialog */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Restore Employee?</h3>
                <p className="text-sm text-muted-foreground">They will be moved back to the active roster.</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-6">
              <span className="font-medium">{confirmRestore.firstName} {confirmRestore.lastName}</span> will be marked as Active again.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-secondary" onClick={() => setConfirmRestore(null)} disabled={isRestoring}>
                Cancel
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleRestore} disabled={isRestoring}>
                {isRestoring ? 'Restoring...' : 'Restore'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Permanent Delete Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Permanently Delete?</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-6">
              This will permanently delete <span className="font-medium">{confirmDelete.firstName} {confirmDelete.lastName}</span> and all their associated data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-secondary" onClick={() => setConfirmDelete(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handlePermanentDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center">
              <UserX className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Inactive Employees</h2>
              <p className="text-muted-foreground text-sm mt-0.5">Employees moved out of the active roster</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Permanent deletion cannot be undone</span>
        </div>
      </div>

      {/* Search */}
      <Card className="bg-card border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search inactive employees by name or contact..."
            className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border overflow-hidden rounded-2xl shadow-lg">
        <div className="p-4 border-b border-border bg-secondary/20">
          <p className="text-sm text-muted-foreground">{filteredEmployees.length} inactive employee{filteredEmployees.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-secondary/50 backdrop-blur-sm">
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Position</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading...</td>
                </tr>
              ) : paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <UserX className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground">No inactive employees</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Employees moved to inactive will appear here</p>
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((employee, index) => {
                  const fullName = `${employee.firstName} ${employee.lastName}`
                  return (
                    <tr
                      key={employee.id}
                      className={`hover:bg-secondary/20 transition-colors opacity-80 ${index % 2 === 0 ? 'bg-transparent' : 'bg-secondary/10'}`}
                    >
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono">#{employee.id.toString().padStart(3, '0')}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center text-gray-400 font-bold text-sm">
                            {employee.firstName.charAt(0)}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-foreground line-through decoration-muted-foreground/40">{fullName}</span>
                            <Badge className="ml-2 bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">Inactive</Badge>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono">{employee.contactNumber || '-'}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="bg-secondary/50 text-muted-foreground border-border">
                          {employee.department || '-'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{employee.position || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-green-400 hover:bg-green-500/10 rounded-lg"
                            onClick={() => setConfirmRestore(employee)}
                            title="Restore to Active"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                            onClick={() => setConfirmDelete(employee)}
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 bg-secondary/20 border-t border-border flex items-center justify-between">
            <span className="text-xs sm:text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 px-2 sm:px-3 border-border text-foreground hover:bg-secondary disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-8 px-2 sm:px-3 border-border text-foreground hover:bg-secondary disabled:opacity-50"
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
