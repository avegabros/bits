import React from 'react';
import ToastContainer from '@/components/ui/ToastContainer';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';
import { EmployeeTable } from './EmployeeTable';
import { EmployeeEditModal } from './EmployeeEditModal';
import { ConfirmDeactivateDialog, ConfirmResetPasswordDialog, ConfirmRestoreDialog, ConfirmPermanentDeleteDialog } from './EmployeeConfirmDialogs';
import { ScanNowModal, EnrollmentLoadingOverlay } from './EmployeeScanModals';
import RFIDCardEnrollmentModal from '@/features/biometrics/components/RFIDCardEnrollmentModal';
import FingerprintDashboardModal from '@/features/biometrics/components/FingerprintDashboardModal';
import { EmployeePageHeader } from './EmployeePageHeader';
import { EmployeeFiltersBar } from './EmployeeFiltersBar';
import { CompanyTabs } from '@/features/attendance/components/CompanyTabs';
import { useEmployeeList } from '../hooks/useEmployeeList';

interface EmployeeListPageProps {
  role: 'admin' | 'hr' | 'manager';
  statusFilter?: 'Active' | 'Inactive';
}

export function EmployeeListPage({ role, statusFilter = 'Active' }: EmployeeListPageProps) {
  const list = useEmployeeList({ statusFilter, role });
  const dragScrollRef = useHorizontalDragScroll();

  return (
    <div className="space-y-6">
      <ToastContainer toasts={list.toasts} onDismiss={list.dismissToast} />

      <EmployeePageHeader
        role={role} statusFilter={statusFilter}
        isExporting={list.isExporting} onExport={list.handleExport}
        departments={list.departments} branches={list.branches} companies={list.companies} shifts={list.shifts}
        onImportComplete={list.refresh}
        isAddOpen={list.isAddOpen} setIsAddOpen={list.setIsAddOpen}
        onRegisterEmployee={async (data) => {
          const res = await list.actions.registerEmployee(data);
          if (res.success) {
            const name = `${res.employee?.firstName || ''} ${res.employee?.lastName || ''}`.trim();
            if (res.deviceSync?.success === false) {
              list.showToast('warning', 'Registered — Device Offline', `${name} was saved but couldn't sync to the device.`);
            } else {
              list.showToast('success', 'Employee Registered', `${name} has been saved.`);
            }
          } else {
            list.showToast('error', 'Registration Failed', res.message || 'Unknown error');
          }
          return res.success;
        }}
      />

      {/* Company Tabs + Filters + Table (tight spacing) */}
      <div className="space-y-2">
        <CompanyTabs
          activeCompany={list.filters.selectedCompany}
          onCompanyChange={list.filters.setSelectedCompany}
          companies={list.companyNames}
        />

        <EmployeeFiltersBar role={role} filters={list.filters} departments={list.departments} branches={list.filteredBranches} shifts={list.shifts} />

        <div className="rounded-2xl shadow-md overflow-hidden bg-white border border-border">
          <EmployeeTable
            employees={list.paginatedEmployees} loading={list.loading} filteredCount={list.employees.length}
            currentPage={list.currentPage} totalPages={list.totalPages}
            sortKey={list.tableSort.sortKey as string} sortOrder={list.tableSort.sortOrder}
            onSort={list.tableSort.handleSort} onPageChange={list.setCurrentPage}
            pageSize={list.rowsPerPage}
            onEdit={(emp) => { list.setEditingEmployee(emp); list.setEditForm({ ...emp }); }}
            onResetPassword={list.setConfirmResetPassword}
            onFingerprintOpen={(id, name) => list.setFingerprintDashboardOpen({ open: true, employeeId: id, employeeName: name })}
            onCardEnrollOpen={(id, name, card) => list.setCardEnrollOpen({ open: true, employeeId: id, employeeName: name, currentCard: card ?? null })}
            enrollStatus={list.enrollStatus} dragScrollRef={dragScrollRef}
            role={role}
            {...(statusFilter === 'Inactive' ? { onRestore: list.setConfirmRestore, onPermanentDelete: list.setConfirmPermanentDelete } : {})}
          />
        </div>
      </div>

      {list.editingEmployee && <EmployeeEditModal
        employee={list.editingEmployee} editForm={list.editForm}
        departments={list.departments} branches={list.branches} companies={list.companies} shifts={list.shifts}
        isSaving={list.isUpdating} onFormChange={list.setEditForm}
        onSave={list.handleUpdateEmployee} onClose={() => list.setEditingEmployee(null)}
        onDuplicateBlur={list.handleDuplicateBlur}
      />}

      {list.confirmDeactivate && <ConfirmDeactivateDialog employee={list.confirmDeactivate} isDeactivating={false} onConfirm={list.handleDeactivate} onCancel={() => list.setConfirmDeactivate(null)} />}
      {list.confirmResetPassword && <ConfirmResetPasswordDialog employee={list.confirmResetPassword} isResetting={list.isResettingPassword} onConfirm={list.handleResetPassword} onCancel={() => list.setConfirmResetPassword(null)} />}

      <ScanNowModal open={list.scanModal.open} employeeName={list.scanModal.employeeName} countdown={list.scanModal.countdown} onClose={() => list.setScanModal(p => ({ ...p, open: false }))} />
      <EnrollmentLoadingOverlay enrollStatus={list.enrollStatus} enrollMsg={list.enrollMsg} />
      <FingerprintDashboardModal
        isOpen={list.fingerprintDashboardOpen.open} employeeId={list.fingerprintDashboardOpen.employeeId} employeeName={list.fingerprintDashboardOpen.employeeName}
        onClose={() => list.setFingerprintDashboardOpen({ open: false, employeeId: null, employeeName: '' })}
        onScanNow={(fi, di) => list.fingerprintDashboardOpen.employeeId && list.handleEnrollFingerprint(list.fingerprintDashboardOpen.employeeId, di, fi)}
      />
      <RFIDCardEnrollmentModal
        isOpen={list.cardEnrollOpen.open} employeeId={list.cardEnrollOpen.employeeId} employeeName={list.cardEnrollOpen.employeeName} currentCard={list.cardEnrollOpen.currentCard}
        onClose={() => list.setCardEnrollOpen({ open: false, employeeId: null, employeeName: '', currentCard: null })}
        onSuccess={(m) => { list.showToast('success', 'Badge Updated', m); list.refresh(); }}
        onError={(m) => list.showToast('error', 'Badge Operation Failed', m)}
      />

      {list.confirmRestore && <ConfirmRestoreDialog employee={list.confirmRestore} isRestoring={list.isRestoring} onConfirm={list.handleRestore} onCancel={() => list.setConfirmRestore(null)} />}
      {list.confirmPermanentDelete && <ConfirmPermanentDeleteDialog employee={list.confirmPermanentDelete} isDeleting={list.isDeleting} onConfirm={list.handlePermanentDelete} onCancel={() => list.setConfirmPermanentDelete(null)} />}
    </div>
  );
}
