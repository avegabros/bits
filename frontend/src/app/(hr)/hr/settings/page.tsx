"use client";
import React, { useState, useEffect } from 'react';
import { Shield, Bell, Lock, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [showToast, setShowToast] = useState(false);
  
  // 1. New state to track the user data from Profile
  const [userData, setUserData] = useState({
    name: "mwehehe",
    role: "HR Payroll Officer"
  });

  // Automatically hide the toast after 3 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // 2. Load the latest Profile data when this page opens
  useEffect(() => {
    const savedData = localStorage.getItem('userData');
    if (savedData) {
      setUserData(JSON.parse(savedData));
    }
  }, []);

  const handleSave = () => {
    // Logic for saving preferences like notifications could go here
    setShowToast(true);
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          Account Settings
        </h2>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95"
        >
          <Save size={18} /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Notifications Section */}
          <div className="bg-white border border-slate-200 p-8 shadow-sm rounded-3xl">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Bell size={16} /> Preferences
            </h3>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div>
                <p className="font-bold text-slate-800">System Notifications</p>
                <p className="text-xs text-slate-500 font-medium">Receive alerts for attendance and report updates</p>
              </div>
              <button 
                onClick={() => setNotifications(!notifications)}
                className={`relative w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ${notifications ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${notifications ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white border border-slate-200 p-8 shadow-sm rounded-3xl">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Lock size={16} /> Security & Password
            </h3>
            
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Current Password</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">New Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="New password"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
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
          </div>
        </div>

        {/* Right Col: Session Info */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-8 text-white rounded-3xl shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Shield size={16} className="text-red-500" /> Security Status
            </h3>
            <div className="space-y-4">
              <div className="pb-4 border-b border-white/10">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Account Role</p>
                {/* 3. This now dynamically updates based on the Profile Page edit */}
                <p className="text-sm font-black text-red-500 uppercase tracking-tighter">
                  {userData.role}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Last Login</p>
                <p className="text-sm font-medium">Today at {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                <p className="text-[10px] text-slate-500 mt-1">IP: 192.168.1.104 (Compostela, Cebu)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
          <div className="bg-emerald-500 p-1 rounded-full">
            <CheckCircle size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">Changes saved successfully!</span>
        </div>
      )}
    </div>
  );
}