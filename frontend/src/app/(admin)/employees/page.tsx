'use client'

import React from "react"
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Search, Plus, Edit2, Trash2, Eye, ChevronLeft, ChevronRight, Upload, AlertTriangle } from 'lucide-react'

type Employee = {
  id: number
  zkId: number | null
  employeeNumber: string | null
  firstName: string
  lastName: string
  email: string | null
  role: string
  department: string | null
  position: string | null
  branch: string | null
  contactNumber: string | null
  hireDate: string | null
  employmentStatus: 'ACTIVE' | 'INACTIVE' | 'TERMINATED'
  createdAt: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDept, setSelectedDept] = useState<string>('all')
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Confirm move-to-inactive dialog
  const [confirmDeactivate, setConfirmDeactivate] = useState<Employee | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  const [newEmployee, setNewEmployee] = useState({
    firstName: '',
    lastName: '',
    contactNumber: '',
    department: '',
    position: '',
    branch: '',
    email: '',
  })

  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[]
  const branches = Array.from(new Set(employees.map(e => e.branch).filter(Boolean))) as string[]

  const fetchEmployees = async () => {
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
        // Active employees page only shows ACTIVE
        setEmployees(data.employees.filter((e: Employee) => e.employmentStatus === 'ACTIVE'))
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase()
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
      (emp.contactNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDept = selectedDept === 'all' || emp.department === selectedDept
    const matchesBranch = selectedBranch === 'all' || emp.branch === selectedBranch
    return matchesSearch && matchesDept && matchesBranch
  })

  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage)
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const handleAddEmployee = async () => {
    if (newEmployee.firstName && newEmployee.lastName && newEmployee.department && newEmployee.position && newEmployee.branch) {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            firstName: newEmployee.firstName,
            lastName: newEmployee.lastName,
            contactNumber: newEmployee.contactNumber || undefined,
            department: newEmployee.department,
            position: newEmployee.position,
            branch: newEmployee.branch,
            email: newEmployee.email || undefined,
          })
        })
        const data = await res.json()
        if (data.success) {
          await fetchEmployees()
          setNewEmployee({ firstName: '', lastName: '', contactNumber: '', department: '', position: '', branch: '', email: '' })
          setIsAddOpen(false)
        } else {
          alert('Failed to add employee: ' + (data.message || 'Unknown error'))
        }
      } catch (error) {
        console.error('Error adding employee:', error)
        alert('Failed to add employee')
      }
    }
  }

  const handleMoveToInactive = async () => {
    if (!confirmDeactivate) return
    setIsDeactivating(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/employees/${confirmDeactivate.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        await fetchEmployees()
        setConfirmDeactivate(null)
      } else {
        alert('Failed to deactivate employee: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error deactivating employee:', error)
      alert('Failed to deactivate employee')
    } finally {
      setIsDeactivating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Confirm Move-to-Inactive Dialog */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Move to Inactive?</h3>
                <p className="text-sm text-muted-foreground">This action can be undone from the Inactive list.</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-6">
              <span className="font-medium">{confirmDeactivate.firstName} {confirmDeactivate.lastName}</span> will be moved to the Inactive employee list and removed from the active roster.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-border text-foreground hover:bg-secondary"
                onClick={() => setConfirmDeactivate(null)}
                disabled={isDeactivating}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleMoveToInactive}
                disabled={isDeactivating}
              >
                {isDeactivating ? 'Moving...' : 'Move to Inactive'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Active Employees</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage your active workforce and employee records</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {/* Import Excel Button */}
          <Dialog open={isImportOpen} onOpenChange={(open) => { setIsImportOpen(open); if (!open) { setImportFile(null); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none border-border text-foreground hover:bg-secondary gap-2">
                <Upload className="w-4 h-4" />
                <span className="hidden xs:inline">Import</span> Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="text-foreground">Import Employees from Excel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload an Excel file (.xlsx, .xls) or CSV (.csv) to bulk import employee records.
                </p>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <label htmlFor="excel-upload" className="cursor-pointer">
                    <span className="text-sm text-primary font-medium hover:underline">Click to select file</span>
                    <input
                      id="excel-upload"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) setImportFile(file)
                      }}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">Supports .xlsx, .xls, .csv</p>
                </div>
                {importFile && (
                  <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-lg">
                    <Upload className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground flex-1 truncate">{importFile.name}</span>
                    <span className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-border text-foreground hover:bg-secondary"
                    onClick={() => { setIsImportOpen(false); setImportFile(null); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90"
                    disabled={!importFile || isImporting}
                    onClick={() => {
                      setIsImporting(true)
                      setTimeout(() => {
                        setIsImporting(false)
                        setIsImportOpen(false)
                        setImportFile(null)
                      }, 1500)
                    }}
                  >
                    {isImporting ? 'Importing...' : 'Upload & Import'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Employee Button */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 gap-2">
                <Plus className="w-4 h-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="text-foreground">Register New Employee</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-foreground">First Name</Label>
                    <Input
                      placeholder="John"
                      className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                      value={newEmployee.firstName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-foreground">Last Name</Label>
                    <Input
                      placeholder="Doe"
                      className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                      value={newEmployee.lastName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-foreground">Email</Label>
                  <Input
                    type="email"
                    placeholder="john@company.com"
                    className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    value={newEmployee.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-foreground">Contact Number</Label>
                  <Input
                    type="tel"
                    placeholder="+63-934-567-8900"
                    className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    value={newEmployee.contactNumber}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmployee({ ...newEmployee, contactNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-foreground">Department</Label>
                  <Input
                    placeholder="Engineering"
                    className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    value={newEmployee.department}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-foreground">Position</Label>
                  <Input
                    placeholder="Job Title"
                    className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    value={newEmployee.position}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-foreground">Branch</Label>
                  <Input
                    placeholder="MAIN OFFICE"
                    className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    value={newEmployee.branch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmployee({ ...newEmployee, branch: e.target.value })}
                  />
                </div>
                <Button onClick={handleAddEmployee} className="w-full bg-primary hover:bg-primary/90">
                  Add Employee
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or contact..."
                className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="flex-1 sm:w-48 bg-secondary border-border text-foreground">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-border">
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="flex-1 sm:w-48 bg-secondary border-border text-foreground">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-border">
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(branch => (
                  <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Employees Table */}
      <Card className="bg-card border-border overflow-hidden rounded-2xl shadow-lg">
        <div className="p-4 border-b border-border bg-secondary/20">
          <p className="text-sm text-muted-foreground">Showing {paginatedEmployees.length} of {filteredEmployees.length} active employees</p>
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
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Loading employees...</td>
                </tr>
              ) : paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No active employees found.</td>
                </tr>
              ) : (
                paginatedEmployees.map((employee, index) => {
                  const fullName = `${employee.firstName} ${employee.lastName}`
                  return (
                    <tr
                      key={employee.id}
                      className={`hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-secondary/10'}`}
                    >
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono">#{employee.id.toString().padStart(3, '0')}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                            {employee.firstName.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-foreground">{fullName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono">{employee.contactNumber || '-'}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="bg-secondary/50 text-foreground border-border">
                          {employee.department || '-'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">{employee.position || '-'}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('en-CA') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 rounded-lg">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 rounded-lg"
                            onClick={() => setConfirmDeactivate(employee)}
                            title="Move to Inactive"
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
        <div className="px-4 sm:px-6 py-4 bg-secondary/20 border-t border-border flex items-center justify-between">
          <span className="text-xs sm:text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </span>
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
            <div className="hidden sm:flex gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 p-0 ${currentPage === page ? 'bg-primary text-white' : 'border-border text-foreground hover:bg-secondary'}`}
                >
                  {page}
                </Button>
              ))}
            </div>
            <span className="sm:hidden text-xs text-muted-foreground px-2">{currentPage}/{totalPages || 1}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="h-8 px-2 sm:px-3 border-border text-foreground hover:bg-secondary disabled:opacity-50"
            >
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
