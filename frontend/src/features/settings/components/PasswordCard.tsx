import { Lock, Eye, EyeOff } from 'lucide-react'
import type { PasswordForm, PasswordStrength } from '../types'

interface PasswordCardProps {
  passwordForm: PasswordForm
  setPasswordForm: (form: PasswordForm) => void
  showPassword: boolean
  setShowPassword: (show: boolean) => void
  isUpdatingPassword: boolean
  onChangePassword: () => void
  strength: PasswordStrength
}

export function PasswordCard({
  passwordForm, setPasswordForm,
  showPassword, setShowPassword,
  isUpdatingPassword, onChangePassword,
  strength,
}: PasswordCardProps) {
  return (
    <div className="bg-white border border-slate-200 p-8 shadow-sm rounded-3xl">
      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
        <Lock size={16} className="text-red-500" /> Security & Password
      </h3>

      <div className="space-y-5 max-w-md">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Current Password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={passwordForm.current}
            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
            placeholder="••••••••"
            className="w-full p-3 bg-red-50/30 border border-red-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.new}
                onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                placeholder="New password"
                className="w-full p-3 bg-red-50/30 border border-red-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
              />
            </div>
            {/* Strength meter */}
            {passwordForm.new && (
              <div className="mt-1">
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                </div>
                <p className={`text-[10px] mt-1 font-bold ${strength.label === 'Weak' ? 'text-red-500' : strength.label === 'Fair' ? 'text-yellow-500' : strength.label === 'Good' ? 'text-blue-500' : 'text-green-500'}`}>
                  Password strength: {strength.label}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                placeholder="Confirm password"
                className="w-full p-3 bg-red-50/30 border border-red-100 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onChangePassword}
          disabled={isUpdatingPassword}
          className="w-full md:w-fit px-8 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-800 transition-all active:scale-95 disabled:opacity-50"
        >
          {isUpdatingPassword ? 'Saving...' : 'Update Password'}
        </button>
      </div>
    </div>
  )
}
