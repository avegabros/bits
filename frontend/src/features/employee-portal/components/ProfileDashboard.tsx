import React, { useState } from 'react'
import { UserCircle, KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, Bell, X } from 'lucide-react'
import { useEmployeeProfile } from '../hooks/useEmployeeProfile'
import { employeeSelfApi } from '@/lib/api'
import { ProfilePictureUpload } from './ProfilePictureUpload'
import { PortalEmployeeProfile } from '../utils/portal-types'
import { useEmployeeOvertime } from '../hooks/useEmployeeOvertime'

export function ProfileDashboard() {
  const {
    loading,
    profile,
    setProfile,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passLoading,
    passMessage,
    showCurrentPassword,
    setShowCurrentPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handleChangePassword
  } = useEmployeeProfile()

  const { requests: overtimeRequests } = useEmployeeOvertime()
  const [dismissedNotifications, setDismissedNotifications] = useState<number[]>([])

  const recentNotifications = overtimeRequests
    .filter(req => req.status !== 'PENDING' && req.reviewedAt && !dismissedNotifications.includes(req.id))
    .filter(req => {
      // Show only if reviewed in the last 7 days
      const reviewDate = new Date(req.reviewedAt!)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      return reviewDate >= sevenDaysAgo
    })
    .sort((a, b) => new Date(b.reviewedAt!).getTime() - new Date(a.reviewedAt!).getTime())
    .slice(0, 3) // Show max 3 recent notifications

  if (loading || !profile) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64"></div>
        <div className="h-64 bg-gray-200 rounded-2xl w-full"></div>
      </div>
    )
  }

  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.trim()

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 lg:gap-8">
      {profile.needsPasswordChange && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-2 rounded-r-lg shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-800">Action Required: Change Your Password</h3>
              <p className="text-sm text-amber-700 mt-1">
                You are currently using a system-generated password. For your security, please update your password below and save it somewhere safe.
              </p>
            </div>
          </div>
        </div>
      )}

      {recentNotifications.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-blue-500" /> Recent Notifications
          </h3>
          <div className="space-y-2">
            {recentNotifications.map(notif => (
              <div key={notif.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm text-slate-700">
                    Your overtime request for <span className="font-bold">{new Date(notif.date).toLocaleDateString()}</span> ({notif.startTime} to {notif.endTime}) has been 
                    <span className={`font-bold ml-1 ${notif.status === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {notif.status}
                    </span>.
                  </p>
                  {notif.status === 'REJECTED' && notif.rejectionReason && (
                    <p className="text-xs text-slate-500 mt-1"><span className="font-bold">Reason:</span> {notif.rejectionReason}</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{new Date(notif.reviewedAt!).toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => setDismissedNotifications(prev => [...prev, notif.id])}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors ml-4 shrink-0"
                  title="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <UserCircle className="w-6 h-6 text-red-600" /> My Profile
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage your personal information and password</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
         {/* Left Col - Avatar & Basic Info */}
         <div className="md:col-span-1 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-red-500" />
               <div className="mb-4">
                 <ProfilePictureUpload
                   currentUrl={profile.profilePicture || null}
                   initials={initials}
                   onUpload={async (file) => {
                     const res = await employeeSelfApi.uploadProfilePicture(file)
                     if (res.success && res.profilePicture && profile) {
                       setProfile({ ...profile, profilePicture: res.profilePicture })
                     }
                   }}
                   onDelete={async () => {
                     const res = await employeeSelfApi.deleteProfilePicture()
                     if (res.success && profile) {
                       setProfile({ ...profile, profilePicture: null })
                     }
                   }}
                 />
               </div>
               <h2 className="text-xl font-black text-slate-900">{profile.firstName}{profile.middleName ? ` ${profile.middleName[0]}.` : ''} {profile.lastName}{profile.suffix ? ` ${profile.suffix}` : ''}</h2>
               <p className="text-slate-500 text-sm mt-1 mb-4">{profile.position || 'Employee'}</p>
               
               <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                 profile.employmentStatus === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
               }`}>
                 {profile.employmentStatus}
               </span>
            </div>
         </div>

         {/* Right Col - Details & Password */}
         <div className="md:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
               <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Employment Details</h3>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</p>
                    <p className="font-medium text-slate-800 mt-1">{profile.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee Number</p>
                    <p className="font-mono text-slate-800 mt-1">{profile.employeeNumber || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Department</p>
                    <p className="font-medium text-slate-800 mt-1">{(profile as any).Department?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Branch</p>
                    <p className="font-medium text-slate-800 mt-1">{(profile as any).Branch?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Number</p>
                    <p className="font-medium text-slate-800 mt-1">{profile.contactNumber || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hire Date</p>
                    <p className="font-medium text-slate-800 mt-1">
                      {profile.hireDate ? new Date(profile.hireDate).toLocaleDateString() : '—'}
                    </p>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
               <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                 <KeyRound className="w-4 h-4 text-amber-500" /> Change Password
               </h3>
               
               <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-600 mb-1.5">Current Password</label>
                   <div className="relative">
                     <input
                       type={showCurrentPassword ? "text" : "password"}
                       value={currentPassword}
                       onChange={(e) => setCurrentPassword(e.target.value)}
                       className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 pr-10 outline-none focus:border-amber-500 transition-colors"
                       required
                     />
                     <button
                       type="button"
                       onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                       className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                     >
                       {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                     </button>
                   </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-bold text-slate-600 mb-1.5">New Password</label>
                     <div className="relative">
                       <input
                         type={showNewPassword ? "text" : "password"}
                         value={newPassword}
                         onChange={(e) => setNewPassword(e.target.value)}
                         className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 pr-10 outline-none focus:border-amber-500 transition-colors"
                         required
                         minLength={6}
                       />
                       <button
                         type="button"
                         onClick={() => setShowNewPassword(!showNewPassword)}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                       >
                         {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </button>
                     </div>
                   </div>
                   <div>
                     <label className="block text-xs font-bold text-slate-600 mb-1.5">Confirm New</label>
                     <div className="relative">
                       <input
                         type={showConfirmPassword ? "text" : "password"}
                         value={confirmPassword}
                         onChange={(e) => setConfirmPassword(e.target.value)}
                         className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 pr-10 outline-none focus:border-amber-500 transition-colors"
                         required
                         minLength={6}
                       />
                       <button
                         type="button"
                         onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                       >
                         {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                       </button>
                     </div>
                   </div>
                 </div>

                 {passMessage && (
                   <div className={`p-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                     passMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                   }`}>
                     {passMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                     {passMessage.text}
                   </div>
                 )}

                 <div className="mt-2 text-right">
                   <button
                     type="submit"
                     disabled={passLoading}
                     className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-6 rounded-xl transition-colors disabled:opacity-50"
                   >
                     {passLoading ? 'Saving...' : 'Save Password'}
                   </button>
                 </div>
               </form>
            </div>
         </div>
      </div>
    </div>
  )
}
