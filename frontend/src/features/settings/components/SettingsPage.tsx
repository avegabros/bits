'use client'

import ToastContainer from '@/components/ui/ToastContainer'
import { useSettings } from '../hooks/useSettings'
import { ProfileCard } from './ProfileCard'
import { PasswordCard } from './PasswordCard'
import { AccountStatusSidebar } from './AccountStatusSidebar'

interface SettingsPageProps {
  role: 'admin' | 'hr' | 'manager'
}

export default function SettingsPage({ role }: SettingsPageProps) {
  const s = useSettings()

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">
          Account Settings
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Profile Card */}
          <ProfileCard
            userData={s.userData}
            setUserData={s.setUserData}
            isEditingProfile={s.isEditingProfile}
            setIsEditingProfile={s.setIsEditingProfile}
            isSavingProfile={s.isSavingProfile}
            onSave={s.handleSaveProfile}
            onCancelClick={() => s.setShowCancelModal(true)}
          />

          {/* Password Card */}
          <PasswordCard
            passwordForm={s.passwordForm}
            setPasswordForm={s.setPasswordForm}
            showPassword={s.showPassword}
            setShowPassword={s.setShowPassword}
            isUpdatingPassword={s.isUpdatingPassword}
            onChangePassword={s.handlePasswordChange}
            strength={s.strength}
          />
        </div>

        {/* Sidebar */}
        <AccountStatusSidebar
          userData={s.userData}
          displayName={s.displayName}
          role={(s.userData.role ? s.userData.role.toLowerCase() : role) as 'admin' | 'hr' | 'manager'}
        />
      </div>

      {/* Cancel Confirmation Modal */}
      {s.showCancelModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-150 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center space-y-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Discard changes?</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">Your unsaved modifications will be lost.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => s.setShowCancelModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={s.confirmCancel}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95"
                >
                  Yes, Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <ToastContainer toasts={s.toasts} onDismiss={s.dismissToast} />
    </div>
  )
}
