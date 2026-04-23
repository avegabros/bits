import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Edit2, Ban, UserCheck } from 'lucide-react'
import { SortableHeader } from '@/components/ui/SortableHeader'
import { DataTablePagination } from '@/components/ui/DataTablePagination'
import { UserAccount } from '../utils/user-types'

interface UserAccountTableProps {
  loading: boolean
  filteredUsersLength: number
  paginatedUsers: UserAccount[]
  currentPage: number
  totalPages: number
  setCurrentPage: (page: number) => void
  sortKey: string | null
  sortOrder: 'asc' | 'desc'
  handleSort: (key: string) => void
  onEdit: (user: UserAccount) => void
  onToggleStatus: (user: UserAccount) => void
}

export function UserAccountTable({
  loading,
  filteredUsersLength,
  paginatedUsers,
  currentPage,
  totalPages,
  setCurrentPage,
  sortKey,
  sortOrder,
  handleSort,
  onEdit,
  onToggleStatus,
}: UserAccountTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div
        className="overflow-x-auto scrollbar-table"
        tabIndex={0}
        role="region"
        aria-label="User accounts table — scroll horizontally"
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
            <tr>
              <SortableHeader 
                label="User" 
                sortKey="firstName" 
                currentSortKey={sortKey} 
                currentSortOrder={sortOrder} 
                onSort={() => handleSort('firstName')} 
                className="px-6 py-4" 
              />
              <SortableHeader 
                label="Email" 
                sortKey="email" 
                currentSortKey={sortKey} 
                currentSortOrder={sortOrder} 
                onSort={() => handleSort('email')} 
                className="px-6 py-4 hidden md:table-cell" 
              />
              <SortableHeader 
                label="Role" 
                sortKey="role" 
                currentSortKey={sortKey} 
                currentSortOrder={sortOrder} 
                onSort={() => handleSort('role')} 
                className="px-6 py-4" 
              />
              <SortableHeader 
                label="Status" 
                sortKey="status" 
                currentSortKey={sortKey} 
                currentSortOrder={sortOrder} 
                onSort={() => handleSort('status')} 
                className="px-6 py-4 hidden sm:table-cell" 
              />
              <SortableHeader 
                label="Created" 
                sortKey="createdAt" 
                currentSortKey={sortKey} 
                currentSortOrder={sortOrder} 
                onSort={() => handleSort('createdAt')} 
                className="px-6 py-4 hidden lg:table-cell" 
              />
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold text-xs">
                  Loading users...
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                  No users found
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-red-50/50 transition-colors duration-200 group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${user.role === 'ADMIN' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                        {user.firstName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-700 truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-slate-400 md:hidden truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-xs font-medium text-slate-500">{user.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant="outline"
                      className={user.role === 'ADMIN'
                        ? 'bg-blue-50 text-blue-600 border-blue-200 text-xs'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-200 text-xs'
                      }
                    >
                      {user.role === 'ADMIN' ? 'Admin' : 'HR'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <Badge
                      variant="outline"
                      className={user.status === 'active'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200 text-xs'
                        : 'bg-red-50 text-red-600 border-red-200 text-xs'
                      }
                    >
                      {user.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className="text-xs font-medium text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString('en-CA')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(user)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                        title="Edit user"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onToggleStatus(user)}
                        className={`p-2.5 rounded-xl transition-all active:scale-90 ${user.status === 'active'
                          ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={user.status === 'active' ? 'Deactivate account' : 'Reactivate account'}
                      >
                        {user.status === 'active'
                          ? <Ban className="w-4 h-4" />
                          : <UserCheck className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DataTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalCount={filteredUsersLength}
        pageSize={10}
        entityName="users"
        loading={loading}
      />
    </div>
  )
}
