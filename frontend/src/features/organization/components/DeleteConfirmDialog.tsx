import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Department, Branch, Company } from '../types'

interface DeleteConfirmDialogProps {
  confirmDeleteDept: Department | null
  confirmDeleteBranch: Branch | null
  confirmDeleteCompany?: Company | null
  deleteLoading: boolean
  deleteError: string | null
  onCancel: () => void
  onDeleteDept: () => void
  onDeleteBranch: () => void
  onDeleteCompany?: () => void
}

export function DeleteConfirmDialog({
  confirmDeleteDept, confirmDeleteBranch, confirmDeleteCompany,
  deleteLoading, deleteError,
  onCancel, onDeleteDept, onDeleteBranch, onDeleteCompany,
}: DeleteConfirmDialogProps) {
  if (!confirmDeleteDept && !confirmDeleteBranch && !confirmDeleteCompany) return null

  const entityType = confirmDeleteDept ? 'Department' : confirmDeleteBranch ? 'Branch' : 'Company'
  const entityName = confirmDeleteDept?.name || confirmDeleteBranch?.name || confirmDeleteCompany?.name
  const onDelete = confirmDeleteDept ? onDeleteDept : confirmDeleteBranch ? onDeleteBranch : (onDeleteCompany ?? (() => {}))

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Remove {entityType}?
            </h3>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-foreground mb-2">
          Are you sure you want to remove <span className="font-medium">
            {entityName}
          </span>?
        </p>
        {confirmDeleteCompany && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
            This company must have no branches assigned before it can be deleted.
          </p>
        )}
        {deleteError && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{deleteError}</p>
        )}
        <div className="flex gap-3 mt-5">
          <Button
            variant="outline"
            className="flex-1 border-border text-foreground hover:bg-secondary"
            onClick={onCancel}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            onClick={onDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remove'}
          </Button>
        </div>
      </div>
    </div>
  )
}
