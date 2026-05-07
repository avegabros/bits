import Image from 'next/image'
import { Save, Mail, MapPin, Phone } from 'lucide-react'
import type { UserData } from '../types'

interface ProfileCardProps {
  userData: UserData
  setUserData: (data: UserData) => void
  isEditingProfile: boolean
  setIsEditingProfile: (editing: boolean) => void
  isSavingProfile: boolean
  onSave: () => void
  onCancelClick: () => void
}

export function ProfileCard({
  userData, setUserData,
  isEditingProfile, setIsEditingProfile,
  isSavingProfile, onSave, onCancelClick,
}: ProfileCardProps) {
  return (
    <div className="bg-white border border-slate-200 overflow-hidden shadow-sm rounded-3xl">
      <div className="h-32 bg-brand" />
      <div className="px-8 pb-8">
        <div className="relative flex justify-between items-end -mt-12 mb-6">
          <div className="h-24 w-24 rounded-3xl bg-brand-bright p-1 shadow-xl border border-slate-100 overflow-hidden">
            <div className="h-full w-full rounded-2xl overflow-hidden relative">
              <Image
                src="/images/av.jpg"
                alt="Avatar"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
          {!isEditingProfile ? (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="px-6 py-2 border border-slate-400 text-slate-600 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 transition-all"
            >
              Edit Personal Info
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onCancelClick}
                className="px-6 py-2 border border-slate-400 text-slate-600 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={isSavingProfile}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95 disabled:opacity-50"
              >
                <Save size={14} /> {isSavingProfile ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">First Name</label>
              <input
                disabled={!isEditingProfile}
                value={userData.firstName}
                onChange={(e) => setUserData({ ...userData, firstName: e.target.value })}
                className="w-full p-3 bg-red-50/30 border border-red-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/10 disabled:opacity-60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Last Name</label>
              <input
                disabled={!isEditingProfile}
                value={userData.lastName}
                onChange={(e) => setUserData({ ...userData, lastName: e.target.value })}
                className="w-full p-3 bg-red-50/30 border border-red-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/10 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" size={16} />
                <input
                  disabled
                  value={userData.email}
                  className="w-full pl-10 p-3 bg-red-50/30 border border-red-100 rounded-xl text-sm font-bold text-slate-700 outline-none disabled:opacity-60"
                />
              </div>
              <p className="text-[10px] text-slate-400 ml-1">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Contact Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" size={16} />
                <input
                  disabled={!isEditingProfile}
                  value={userData.contactNumber}
                  onChange={(e) => setUserData({ ...userData, contactNumber: e.target.value })}
                  placeholder="+63-000-000-0000"
                  className="w-full pl-10 p-3 bg-red-50/30 border border-red-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-60 placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Branch</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" size={16} />
                <input
                  disabled
                  value={userData.branch || 'Not assigned'}
                  className="w-full pl-10 p-3 bg-red-50/30 border border-red-100 rounded-xl text-sm font-bold text-slate-700 outline-none disabled:opacity-60"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Department</label>
              <input
                disabled
                value={userData.department || 'Not assigned'}
                className="w-full p-3 bg-red-50/30 border border-red-100 rounded-xl text-sm font-bold text-slate-700 outline-none disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
