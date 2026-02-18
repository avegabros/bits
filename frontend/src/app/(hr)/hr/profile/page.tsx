"use client";
import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, MapPin, Calendar, Camera, Check, X, CheckCircle, Trash2 } from 'lucide-react';

export default function ProfilePage() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Profile updated successfully!");
  const [userData, setUserData] = useState({
    name: "mwehehe",
    role: "HR Payroll Officer",
    email: "admin@bipbip.com",
    site: "Cebu Office",
    joined: "January 2024"
  });

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  useEffect(() => {
    const savedImage = localStorage.getItem('userProfileImage');
    if (savedImage) setProfileImage(savedImage);
    const savedData = localStorage.getItem('userData');
    if (savedData) setUserData(JSON.parse(savedData));
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfileImage(base64String);
        localStorage.setItem('userProfileImage', base64String);
        window.dispatchEvent(new Event('profileUpdate'));
      };
      reader.readAsDataURL(file);
    }
  };

  // NEW: Function to clear the profile photo
  const handleClearPhoto = () => {
    setProfileImage(null);
    localStorage.removeItem('userProfileImage');
    window.dispatchEvent(new Event('profileUpdate'));
    setToastMessage("Profile photo removed!");
    setShowToast(true);
  };

  const handleSave = () => {
    localStorage.setItem('userData', JSON.stringify(userData));
    setIsEditing(false);
    setToastMessage("Profile updated successfully!");
    setShowToast(true);
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">HR Profile</h2>
      </div>

      <div className="bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="h-32 bg-[#E60000]" />

        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="h-24 w-24 rounded-3xl bg-white p-1 shadow-xl overflow-hidden">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="h-full w-full rounded-2xl object-cover" />
                  ) : (
                    <div className="h-full w-full rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <User size={48} />
                    </div>
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl cursor-pointer">
                  <Camera size={24} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>

              {/* NEW: Clear Photo Button - Only shows if there is an image */}
              {profileImage && (
                <button
                  onClick={handleClearPhoto}
                  className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 rounded-2xl transition-all shadow-sm group"
                  title="Remove Photo"
                >
                  <Trash2 size={20} className="group-hover:scale-110 transition-transform" />
                </button>
              )}
            </div>

            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-800 transition-all active:scale-95"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                >
                  <X size={16} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                >
                  <Check size={16} /> Save Changes
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      className="text-2xl font-black text-slate-800 uppercase tracking-tighter border-b-2 border-red-500 outline-none w-full bg-slate-50 px-2"
                      value={userData.name}
                      onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                    />
                    <input
                      className="text-red-600 font-bold text-sm uppercase tracking-widest border-b border-red-200 outline-none w-full bg-slate-50 px-2"
                      value={userData.role}
                      onChange={(e) => setUserData({ ...userData, role: e.target.value })}
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{userData.name}</h3>
                    <p className="text-red-600 font-bold text-sm uppercase tracking-widest">{userData.role}</p>
                  </>
                )}
              </div>

              <div className="space-y-3 pt-4 text-slate-600">
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-slate-400" />
                  {isEditing ? (
                    <input
                      className="text-sm font-medium border-b border-slate-200 outline-none w-full bg-slate-50"
                      value={userData.email}
                      onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                    />
                  ) : (
                    <span className="text-sm font-medium">{userData.email}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-slate-400" />
                  {isEditing ? (
                    <input
                      className="text-sm font-medium border-b border-slate-200 outline-none w-full bg-slate-50"
                      value={userData.site}
                      onChange={(e) => setUserData({ ...userData, site: e.target.value })}
                    />
                  ) : (
                    <span className="text-sm font-medium">{userData.site}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-slate-400" />
                  <span className="text-sm font-medium">Joined {userData.joined}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 h-fit">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Shield size={14} /> System Permissions
              </h4>
              <ul className="space-y-2">
                {['Full Access', 'Attendance Correction', 'Report Generation', 'User Management'].map((perm) => (
                  <li key={perm} className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {perm}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Synchronized Toast Message */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
          <div className="bg-emerald-500 p-1 rounded-full">
            <CheckCircle size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}