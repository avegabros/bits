'use client'

import { Building2, Building, MapPin, Users, Search, LayoutGrid, List, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTableSort } from '@/hooks/useTableSort'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import ToastContainer from '@/components/ui/ToastContainer'

import { useOrganization } from '../hooks/useOrganization'
import type { Department, Company } from '../types'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { EditDepartmentDialog } from './EditDepartmentDialog'
import { EditBranchDialog } from './EditBranchDialog'
import { EditCompanyDialog } from './EditCompanyDialog'
import { AddOrganizationDialog } from './AddOrganizationDialog'
import { CompanyCards } from './CompanyCards'
import { BranchCards } from './BranchCards'
import { DepartmentGrid } from './DepartmentGrid'
import { DepartmentTable } from './DepartmentTable'

interface OrganizationPageProps {
  role: 'admin' | 'hr'
}

export default function OrganizationPage({ role }: OrganizationPageProps) {
  const org = useOrganization()

  const { sortedData: sortedDepts, sortKey, sortOrder, handleSort } = useTableSort<Department>({
    initialData: org.filteredDepts,
  })

  const paginatedDepts = sortedDepts.slice(
    (org.currentPage - 1) * org.rowsPerPage,
    org.currentPage * org.rowsPerPage
  )

  // ── Handlers for opening edit/delete dialogs (pass state setters down) ──
  const openEditDept = (dept: Department) => {
    org.setEditingDept(dept)
    org.setEditName(dept.name)
    org.setEditError(null)
  }

  const openDeleteDept = (dept: Department) => {
    org.setConfirmDeleteDept(dept)
    org.setDeleteError(null)
  }

  const openEditBranch = (branch: typeof org.branches[0]) => {
    org.setEditingBranch(branch)
    org.setEditBranchName(branch.name)
    org.setEditBranchCompanyIds((branch.companies || []).map(c => c.companyId))
    org.setEditBranchError(null)
  }

  const openDeleteBranch = (branch: typeof org.branches[0]) => {
    org.setConfirmDeleteBranch(branch)
    org.setDeleteError(null)
  }

  const openEditCompany = (company: Company) => {
    org.setEditingCompany(company)
    org.setEditCompanyName(company.name)
    org.setEditCompanyAddress(company.address || '')

    org.setEditCompanyError(null)
  }

  const openDeleteCompany = (company: Company) => {
    org.setConfirmDeleteCompany(company)
    org.setDeleteError(null)
  }

  return (
    <div className="space-y-6">

      {/* ── Delete Confirmation ── */}
      <DeleteConfirmDialog
        confirmDeleteDept={org.confirmDeleteDept}
        confirmDeleteBranch={org.confirmDeleteBranch}
        confirmDeleteCompany={org.confirmDeleteCompany}
        deleteLoading={org.deleteLoading}
        deleteError={org.deleteError}
        onCancel={() => {
          org.setConfirmDeleteDept(null)
          org.setConfirmDeleteBranch(null)
          org.setConfirmDeleteCompany(null)
          org.setDeleteError(null)
        }}
        onDeleteDept={org.handleDeleteDept}
        onDeleteBranch={org.handleDeleteBranch}
        onDeleteCompany={org.handleDeleteCompany}
      />

      {/* ── Edit Department Dialog ── */}
      <EditDepartmentDialog
        editingDept={org.editingDept}
        editName={org.editName}
        setEditName={org.setEditName}
        editLoading={org.editLoading}
        editError={org.editError}
        onSave={org.handleEditSave}
        onCancel={() => { org.setEditingDept(null); org.setEditError(null) }}
      />

      {/* ── Edit Branch Dialog ── */}
      <EditBranchDialog
        editingBranch={org.editingBranch}
        editBranchName={org.editBranchName}
        setEditBranchName={org.setEditBranchName}
        editBranchCompanyIds={org.editBranchCompanyIds}
        setEditBranchCompanyIds={org.setEditBranchCompanyIds}
        companies={org.companies}
        editBranchLoading={org.editBranchLoading}
        editBranchError={org.editBranchError}
        onSave={org.handleEditBranchSave}
        onCancel={() => { org.setEditingBranch(null); org.setEditBranchError(null) }}
      />

      {/* ── Edit Company Dialog ── */}
      <EditCompanyDialog
        editingCompany={org.editingCompany}
        editCompanyName={org.editCompanyName}
        setEditCompanyName={org.setEditCompanyName}
        editCompanyAddress={org.editCompanyAddress}
        setEditCompanyAddress={org.setEditCompanyAddress}

        editCompanyLoading={org.editCompanyLoading}
        editCompanyError={org.editCompanyError}
        onSave={org.handleEditCompanySave}
        onCancel={() => { org.setEditingCompany(null); org.setEditCompanyError(null) }}
      />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Organization</h2>
            <p className="text-muted-foreground text-sm mt-0.5">Manage companies, departments &amp; branches</p>
          </div>
        </div>

        <AddOrganizationDialog
          isAddOpen={org.isAddOpen}
          setIsAddOpen={org.setIsAddOpen}
          addType={org.addType}
          setAddType={org.setAddType}
          newName={org.newName}
          setNewName={org.setNewName}
          newAddress={org.newAddress}
          setNewAddress={org.setNewAddress}
          addLoading={org.addLoading}
          addError={org.addError}
          setAddError={org.setAddError}
          onAdd={org.handleAdd}
        />
      </div>

      {org.apiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 font-medium">
          {org.apiError}
        </div>
      )}

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Companies</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{org.loading ? '—' : org.companies.length}</p>
              <p className="text-xs text-slate-400 mt-1">Registered companies</p>
            </div>
            <div className="p-2.5 rounded-lg bg-violet-50"><Building className="w-5 h-5 text-violet-600" /></div>
          </div>
        </Card>
        <Card className="bg-white border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Departments</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{org.loading ? '—' : org.departments.length}</p>
              <p className="text-xs text-slate-400 mt-1">Active departments</p>
            </div>
            <div className="p-2.5 rounded-lg bg-red-50"><Building2 className="w-5 h-5 text-red-600" /></div>
          </div>
        </Card>
        <Card className="bg-white border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Branches</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{org.loading ? '—' : org.branches.length}</p>
              <p className="text-xs text-slate-400 mt-1">Office locations</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50"><MapPin className="w-5 h-5 text-blue-600" /></div>
          </div>
        </Card>
        <Card className="bg-white border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400 font-medium">Total Workforce</p>
              <p className="text-3xl font-bold text-slate-800 mt-1">{org.loading ? '—' : org.totalEmployees}</p>
              <p className="text-xs text-slate-400 mt-1">Active employees</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50"><Users className="w-5 h-5 text-emerald-600" /></div>
          </div>
        </Card>
      </div>

      {/* ── Companies Cards ── */}
      <CompanyCards
        companies={org.companies}
        loading={org.loading}
        onEditCompany={openEditCompany}
        onDeleteCompany={openDeleteCompany}
      />

      {/* ── Branches Cards ── */}
      <BranchCards
        branches={org.branches}
        branchCounts={org.branchCounts}
        loading={org.loading}
        onEditBranch={openEditBranch}
        onDeleteBranch={openDeleteBranch}
      />

      {/* ── Search + Filter + View Toggle ── */}
      <Card className="bg-white border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search departments..."
              className="pl-10 bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-300"
              value={org.searchTerm}
              onChange={e => org.setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={org.branchFilter} onValueChange={org.setBranchFilter}>
            <SelectTrigger className="w-full sm:w-44 bg-slate-50 border-slate-200 text-slate-700">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200">
              <SelectItem value="all">All Branches</SelectItem>
              {org.branches.map(branch => (
                <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => org.setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${org.viewMode === 'grid' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => org.setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${org.viewMode === 'list' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>
      </Card>

      {/* ── Departments heading ── */}
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
        Departments {org.branchFilter !== 'all' && <span className="text-red-500">· {org.branchFilter}</span>}
      </h3>

      {org.loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading departments...
        </div>
      ) : org.viewMode === 'grid' ? (
        <DepartmentGrid
          paginatedDepts={paginatedDepts}
          deptCounts={org.deptCounts}
          currentPage={org.currentPage}
          rowsPerPage={org.rowsPerPage}
          totalCount={sortedDepts.length}
          onEditDept={openEditDept}
          onDeleteDept={openDeleteDept}
        />
      ) : (
        <DepartmentTable
          paginatedDepts={paginatedDepts}
          deptCounts={org.deptCounts}
          currentPage={org.currentPage}
          rowsPerPage={org.rowsPerPage}
          totalCount={sortedDepts.length}
          sortKey={sortKey as string | null}
          sortOrder={sortOrder}
          handleSort={handleSort}
          onEditDept={openEditDept}
          onDeleteDept={openDeleteDept}
        />
      )}

      <DataTablePagination
        currentPage={org.currentPage}
        totalPages={Math.ceil(org.filteredDepts.length / org.rowsPerPage)}
        onPageChange={org.setCurrentPage}
        totalCount={org.filteredDepts.length}
        pageSize={org.rowsPerPage}
        entityName="departments"
        loading={org.loading}
      />

      <ToastContainer toasts={org.toasts} onDismiss={org.dismissToast} />
    </div>
  )
}
