'use client'

import React from "react"

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, Plus, Edit2, Trash2, Eye, ChevronLeft, ChevronRight, Upload } from 'lucide-react'
import { employees as mockEmployees, departments, branches, type Employee } from '@/lib/mock-data'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState(mockEmployees)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDept, setSelectedDept] = useState<string>('all')
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    contactNumber: '',
    department: '',
    position: '',
    branch: '',
    bio: ''
  })

  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.contactNumber.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDept = selectedDept === 'all' || emp.department === selectedDept
    const matchesBranch = selectedBranch === 'all' || emp.branch === selectedBranch
    return matchesSearch && matchesDept && matchesBranch
  })

  const totalPages = Math.ceil(filteredEmployees.length / rowsPerPage)
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  )

  const handleAddEmployee = () => {
    if (newEmployee.name && newEmployee.contactNumber && newEmployee.department && newEmployee.position && newEmployee.branch) {
      const employee = {
        id: employees.length + 1,
        ...newEmployee,
        status: 'active' as const,
        joinDate: new Date().toISOString().split('T')[0]
      } as Employee
      setEmployees([...employees, employee])
      setNewEmployee({ name: '', contactNumber: '', department: '', position: '', branch: '', bio: '' })
      setIsAddOpen(false)
    }
  }

  const deleteEmployee = (id: number) => {
    setEmployees(employees.filter(emp => emp.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Employees</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage your workforce and employee records</p>
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
                      // TODO: Implement actual Excel upload to backend
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
                <div>
                  <Label className="text-foreground">Full Name</Label>
                  <Input
                    placeholder="John Doe"
                    className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    value={newEmployee.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmployee({ ...newEmployee, name: e.target.value })}
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
                  <Select value={newEmployee.department} onValueChange={(value: string) => setNewEmployee({ ...newEmployee, department: value })}>
                    <SelectTrigger className="mt-1 bg-secondary border-border text-foreground">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent className="bg-secondary border-border">
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Select value={newEmployee.branch} onValueChange={(value: string) => setNewEmployee({ ...newEmployee, branch: value })}>
                    <SelectTrigger className="mt-1 bg-secondary border-border text-foreground">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent className="bg-secondary border-border">
                      {branches.map(branch => (
                        <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-foreground">Bio</Label>
                  <Textarea
                    placeholder="Employee bio..."
                    className="mt-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    rows={3}
                    value={newEmployee.bio}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewEmployee({ ...newEmployee, bio: e.target.value })}
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
          <p className="text-sm text-muted-foreground">Showing {paginatedEmployees.length} of {filteredEmployees.length} employees</p>
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
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedEmployees.map((employee, index) => (
                <tr
                  key={employee.id}
                  className={`hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-secondary/10'}`}
                >
                  <td className="px-6 py-4 text-sm text-muted-foreground font-mono">#{employee.id.toString().padStart(3, '0')}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        {employee.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-foreground">{employee.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground font-mono">{employee.contactNumber}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className="bg-secondary/50 text-foreground border-border">
                      {employee.department}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">{employee.position}</td>
                  <td className="px-6 py-4">
                    <Badge className={employee.status === 'active'
                      ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
                      : 'bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30'}>
                      <span className={`w-2 h-2 rounded-full mr-2 ${employee.status === 'active' ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                      {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{employee.joinDate}</td>
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
                        className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                        onClick={() => deleteEmployee(employee.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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
