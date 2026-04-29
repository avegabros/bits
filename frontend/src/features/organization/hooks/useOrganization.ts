'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import type { Department, Branch, Company } from '../types'

export function useOrganization() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [deptCounts, setDeptCounts] = useState<Record<string, number>>({})
  const [branchCounts, setBranchCounts] = useState<Record<string, number>>({})
  const [allEmployees, setAllEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)
  const { toasts, showToast, dismissToast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  // Add dialog
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addType, setAddType] = useState<'department' | 'branch' | 'company'>('department')
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newLogo, setNewLogo] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Edit department dialog
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [editName, setEditName] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Edit branch dialog
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [editBranchName, setEditBranchName] = useState('')
  const [editBranchCompanyIds, setEditBranchCompanyIds] = useState<number[]>([])
  const [editBranchLoading, setEditBranchLoading] = useState(false)
  const [editBranchError, setEditBranchError] = useState<string | null>(null)

  // Edit company dialog
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editCompanyName, setEditCompanyName] = useState('')
  const [editCompanyAddress, setEditCompanyAddress] = useState('')
  const [editCompanyLogo, setEditCompanyLogo] = useState('')
  const [editCompanyLoading, setEditCompanyLoading] = useState(false)
  const [editCompanyError, setEditCompanyError] = useState<string | null>(null)

  // Delete confirmation
  const [confirmDeleteDept, setConfirmDeleteDept] = useState<Department | null>(null)
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<Branch | null>(null)
  const [confirmDeleteCompany, setConfirmDeleteCompany] = useState<Company | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Helpers ──
  const authHeaders = () => ({
    'Content-Type': 'application/json',
  })

  // ── Initial load ──
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [deptRes, branchRes, companyRes, empRes] = await Promise.all([
          fetch('/api/departments', { credentials: 'include' }),
          fetch('/api/branches', { credentials: 'include' }),
          fetch('/api/companies', { credentials: 'include' }),
          fetch('/api/employees', { credentials: 'include' }),
        ])
        const [deptData, branchData, companyData, empData] = await Promise.all([
          deptRes.json(), branchRes.json(), companyRes.json(), empRes.json(),
        ])

        if (deptData.success) setDepartments(deptData.departments)
        if (branchData.success) setBranches(branchData.branches)
        if (companyData.success) setCompanies(companyData.companies)
        if (empData.success) {
          const activeEmps = (empData.employees || []).filter((e: any) =>
            e.employmentStatus === 'ACTIVE'
          )
          setAllEmployees(activeEmps)

          const dCounts: Record<string, number> = {}
          const bCounts: Record<string, number> = {}
          activeEmps.forEach((e: any) => {
            if (e.Department?.name) dCounts[e.Department.name] = (dCounts[e.Department.name] || 0) + 1
            if (e.Branch?.name) bCounts[e.Branch.name] = (bCounts[e.Branch.name] || 0) + 1
          })
          setDeptCounts(dCounts)
          setBranchCounts(bCounts)
        }
      } catch {
        setApiError('Failed to load data. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Filtered departments ──
  const filteredDepts = departments.filter(d => {
    if (!d.name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (branchFilter !== 'all') {
      return allEmployees.some(e => e.Department?.name === d.name && e.Branch?.name === branchFilter)
    }
    return true
  })

  useEffect(() => { setCurrentPage(1) }, [searchTerm, branchFilter])

  const totalEmployees = allEmployees.length

  // ── Add ──
  const handleAdd = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setAddLoading(true)
    setAddError(null)
    try {
      if (addType === 'company') {
        const res = await fetch('/api/companies', {
          method: 'POST', headers: authHeaders(), credentials: 'include',
          body: JSON.stringify({ name: trimmed, address: newAddress.trim() || null, logo: newLogo.trim() || null }),
        })
        const data = await res.json()
        if (!data.success) { setAddError(data.message || 'Failed to create'); return }
        setCompanies(prev => [...prev, data.company].sort((a, b) => a.name.localeCompare(b.name)))
        setNewName(''); setNewAddress(''); setNewLogo(''); setIsAddOpen(false)
        showToast('success', 'Company Created', `${trimmed} has been added successfully`)
      } else {
        const endpoint = addType === 'department' ? '/api/departments' : '/api/branches'
        const res = await fetch(endpoint, {
          method: 'POST', headers: authHeaders(), credentials: 'include',
          body: JSON.stringify({ name: trimmed }),
        })
        const data = await res.json()
        if (!data.success) { setAddError(data.message || 'Failed to create'); return }
        if (addType === 'department') {
          setDepartments(prev => [...prev, data.department].sort((a, b) => a.name.localeCompare(b.name)))
        } else {
          setBranches(prev => [...prev, data.branch].sort((a, b) => a.name.localeCompare(b.name)))
        }
        setNewName(''); setIsAddOpen(false)
        showToast('success', addType === 'department' ? 'Department Created' : 'Branch Created', `${trimmed} has been added successfully`)
      }
    } catch {
      setAddError('Network error. Please try again.')
    } finally {
      setAddLoading(false)
    }
  }

  // ── Rename department ──
  const handleEditSave = async () => {
    if (!editingDept || !editName.trim()) return
    setEditLoading(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/departments/${editingDept.id}`, {
        method: 'PUT', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ name: editName.trim() }),
      })
      const data = await res.json()
      if (!data.success) { setEditError(data.message || 'Failed to rename'); return }
      setDepartments(prev =>
        prev.map(d => d.id === editingDept.id ? data.department : d)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      if (deptCounts[editingDept.name]) {
        setDeptCounts(prev => {
          const next = { ...prev }
          next[data.department.name] = next[editingDept.name] || 0
          delete next[editingDept.name]
          return next
        })
      }
      setAllEmployees(prev =>
        prev.map(e => e.departmentId === editingDept.id
          ? { ...e, Department: { name: data.department.name } } : e)
      )
      setEditingDept(null)
      showToast('success', 'Department Renamed', `Department renamed to ${data.department.name}`)
    } catch { setEditError('Network error. Please try again.') }
    finally { setEditLoading(false) }
  }

  // ── Edit branch (rename + sync company assignments) ──
  const handleEditBranchSave = async () => {
    if (!editingBranch || !editBranchName.trim()) return
    setEditBranchLoading(true)
    setEditBranchError(null)
    try {
      // Rename branch
      const res = await fetch(`/api/branches/${editingBranch.id}`, {
        method: 'PUT', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ name: editBranchName.trim() }),
      })
      const data = await res.json()
      if (!data.success) { setEditBranchError(data.message || 'Failed to rename'); return }

      // Sync company assignments: diff current vs. desired
      const currentIds = (editingBranch.companies || []).map(c => c.companyId)
      const desiredIds = editBranchCompanyIds
      const toAdd = desiredIds.filter(id => !currentIds.includes(id))
      const toRemove = currentIds.filter(id => !desiredIds.includes(id))

      for (const companyId of toAdd) {
        await fetch(`/api/branches/${editingBranch.id}/companies`, {
          method: 'POST', headers: authHeaders(), credentials: 'include',
          body: JSON.stringify({ companyId }),
        })
      }
      for (const companyId of toRemove) {
        await fetch(`/api/branches/${editingBranch.id}/companies/${companyId}`, {
          method: 'DELETE', headers: authHeaders(), credentials: 'include',
        })
      }

      // Refresh branches and companies to get accurate counts
      const [branchRefresh, companyRefresh] = await Promise.all([
        fetch('/api/branches', { credentials: 'include' }),
        fetch('/api/companies', { credentials: 'include' }),
      ])
      const [branchRefreshData, companyRefreshData] = await Promise.all([
        branchRefresh.json(), companyRefresh.json(),
      ])
      if (branchRefreshData.success) setBranches(branchRefreshData.branches)
      if (companyRefreshData.success) setCompanies(companyRefreshData.companies)

      // Update employee branch name counts
      if (branchCounts[editingBranch.name]) {
        setBranchCounts(prev => {
          const next = { ...prev }
          next[data.branch.name] = next[editingBranch.name] || 0
          delete next[editingBranch.name]
          return next
        })
      }
      setAllEmployees(prev =>
        prev.map(e => e.branchId === editingBranch.id
          ? { ...e, Branch: { name: data.branch.name } } : e)
      )
      setEditingBranch(null)
      showToast('success', 'Branch Updated', `Branch updated to ${data.branch.name}`)
    } catch { setEditBranchError('Network error. Please try again.') }
    finally { setEditBranchLoading(false) }
  }

  // ── Edit company ──
  const handleEditCompanySave = async () => {
    if (!editingCompany || !editCompanyName.trim()) return
    setEditCompanyLoading(true)
    setEditCompanyError(null)
    try {
      const res = await fetch(`/api/companies/${editingCompany.id}`, {
        method: 'PUT', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({
          name: editCompanyName.trim(),
          address: editCompanyAddress.trim() || null,
          logo: editCompanyLogo.trim() || null,
        }),
      })
      const data = await res.json()
      if (!data.success) { setEditCompanyError(data.message || 'Failed to update'); return }
      setCompanies(prev =>
        prev.map(c => c.id === editingCompany.id ? data.company : c)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      // Update branch company names if changed
      if (editingCompany.name !== data.company.name) {
        setBranches(prev =>
          prev.map(b => ({
            ...b,
            companies: (b.companies || []).map(link =>
              link.companyId === editingCompany.id
                ? { ...link, company: { ...link.company, name: data.company.name } }
                : link
            ),
          }))
        )
      }
      setEditingCompany(null)
      showToast('success', 'Company Updated', `Company updated to ${data.company.name}`)
    } catch { setEditCompanyError('Network error. Please try again.') }
    finally { setEditCompanyLoading(false) }
  }

  // ── Delete department ──
  const handleDeleteDept = async () => {
    if (!confirmDeleteDept) return
    setDeleteLoading(true); setDeleteError(null)
    try {
      const res = await fetch(`/api/departments/${confirmDeleteDept.id}`, {
        method: 'DELETE', headers: authHeaders(), credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) { setDeleteError(data.message || 'Failed to delete'); return }
      setDepartments(prev => prev.filter(d => d.id !== confirmDeleteDept.id))
      setConfirmDeleteDept(null)
      showToast('success', 'Department Removed', `${confirmDeleteDept.name} has been removed`)
    } catch { setDeleteError('Network error. Please try again.') }
    finally { setDeleteLoading(false) }
  }

  // ── Delete branch ──
  const handleDeleteBranch = async () => {
    if (!confirmDeleteBranch) return
    setDeleteLoading(true); setDeleteError(null)
    try {
      const res = await fetch(`/api/branches/${confirmDeleteBranch.id}`, {
        method: 'DELETE', headers: authHeaders(), credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) { setDeleteError(data.message || 'Failed to delete'); return }
      setBranches(prev => prev.filter(b => b.id !== confirmDeleteBranch.id))
      setConfirmDeleteBranch(null)
      // Refresh company counts
      const companyRes = await fetch('/api/companies', { credentials: 'include' })
      const companyData = await companyRes.json()
      if (companyData.success) setCompanies(companyData.companies)
      showToast('success', 'Branch Removed', `${confirmDeleteBranch.name} has been removed`)
    } catch { setDeleteError('Network error. Please try again.') }
    finally { setDeleteLoading(false) }
  }

  // ── Delete company ──
  const handleDeleteCompany = async () => {
    if (!confirmDeleteCompany) return
    setDeleteLoading(true); setDeleteError(null)
    try {
      const res = await fetch(`/api/companies/${confirmDeleteCompany.id}`, {
        method: 'DELETE', headers: authHeaders(), credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) { setDeleteError(data.message || 'Failed to delete'); return }
      setCompanies(prev => prev.filter(c => c.id !== confirmDeleteCompany.id))
      setConfirmDeleteCompany(null)
      showToast('success', 'Company Removed', `${confirmDeleteCompany.name} has been removed`)
    } catch { setDeleteError('Network error. Please try again.') }
    finally { setDeleteLoading(false) }
  }

  return {
    departments, branches, companies, deptCounts, branchCounts, allEmployees,
    loading, apiError, totalEmployees, filteredDepts,
    currentPage, setCurrentPage, rowsPerPage,
    searchTerm, setSearchTerm, branchFilter, setBranchFilter,
    viewMode, setViewMode,
    isAddOpen, setIsAddOpen, addType, setAddType,
    newName, setNewName, newAddress, setNewAddress, newLogo, setNewLogo,
    addLoading, addError, setAddError, handleAdd,
    editingDept, setEditingDept, editName, setEditName,
    editLoading, editError, setEditError, handleEditSave,
    editingBranch, setEditingBranch, editBranchName, setEditBranchName,
    editBranchCompanyIds, setEditBranchCompanyIds,
    editBranchLoading, editBranchError, setEditBranchError, handleEditBranchSave,
    editingCompany, setEditingCompany,
    editCompanyName, setEditCompanyName,
    editCompanyAddress, setEditCompanyAddress,
    editCompanyLogo, setEditCompanyLogo,
    editCompanyLoading, editCompanyError, setEditCompanyError, handleEditCompanySave,
    confirmDeleteDept, setConfirmDeleteDept,
    confirmDeleteBranch, setConfirmDeleteBranch,
    confirmDeleteCompany, setConfirmDeleteCompany,
    deleteLoading, deleteError, setDeleteError,
    handleDeleteDept, handleDeleteBranch, handleDeleteCompany,
    toasts, showToast, dismissToast,
  }
}
