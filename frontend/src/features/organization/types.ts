// ── Organization Feature Types ──────────────────────────────────────

export interface Department {
  id: number
  name: string
}

export interface Company {
  id: number
  name: string
  logo?: string | null
  address?: string | null
  _count?: { branches: number }
}

export interface CompanyBranchLink {
  companyId: number
  branchId: number
  company: { id: number; name: string; logo?: string | null; address?: string | null }
}

export interface Branch {
  id: number
  name: string
  address?: string | null
  companies?: CompanyBranchLink[]
}

export const DEPT_COLORS = [
  { bg: 'bg-red-50', border: 'border-red-100', icon: 'bg-red-500', text: 'text-red-600', light: 'text-red-400', accent: '#C8102E' },
  { bg: 'bg-blue-50', border: 'border-blue-100', icon: 'bg-blue-500', text: 'text-blue-600', light: 'text-blue-400', accent: '#3b82f6' },
  { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'bg-amber-500', text: 'text-amber-600', light: 'text-amber-400', accent: '#f59e0b' },
  { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'bg-emerald-500', text: 'text-emerald-600', light: 'text-emerald-400', accent: '#10b981' },
  { bg: 'bg-purple-50', border: 'border-purple-100', icon: 'bg-purple-500', text: 'text-purple-600', light: 'text-purple-400', accent: '#8b5cf6' },
  { bg: 'bg-pink-50', border: 'border-pink-100', icon: 'bg-pink-500', text: 'text-pink-600', light: 'text-pink-400', accent: '#ec4899' },
  { bg: 'bg-cyan-50', border: 'border-cyan-100', icon: 'bg-cyan-500', text: 'text-cyan-600', light: 'text-cyan-400', accent: '#06b6d4' },
  { bg: 'bg-orange-50', border: 'border-orange-100', icon: 'bg-orange-500', text: 'text-orange-600', light: 'text-orange-400', accent: '#f97316' },
  { bg: 'bg-indigo-50', border: 'border-indigo-100', icon: 'bg-indigo-500', text: 'text-indigo-600', light: 'text-indigo-400', accent: '#6366f1' },
  { bg: 'bg-teal-50', border: 'border-teal-100', icon: 'bg-teal-500', text: 'text-teal-600', light: 'text-teal-400', accent: '#14b8a6' },
] as const

export function getColor(index: number) {
  return DEPT_COLORS[index % DEPT_COLORS.length]
}

export function getInitials(name: string) {
  const words = name.replace(' DEPARTMENT', '').split(' ')
  return words.length >= 2 ? words[0][0] + words[1][0] : words[0].substring(0, 2)
}
