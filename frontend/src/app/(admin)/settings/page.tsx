'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  User,
  Lock,
  Mail,
  Phone,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Camera
} from 'lucide-react'

export default function SettingsPage() {
  const [userName, setUserName] = useState('Admin')
  const [userEmail, setUserEmail] = useState('admin@avega.com')

  // Profile form
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => {
    try {
      const employee = localStorage.getItem('employee')
      if (employee) {
        const parsed = JSON.parse(employee)
        setFirstName(parsed.firstName || '')
        setLastName(parsed.lastName || '')
        setUserName(`${parsed.firstName || ''} ${parsed.lastName || ''}`.trim() || 'Admin')
        setUserEmail(parsed.email || 'admin@avega.com')
        setPhone(parsed.phone || '+63-000-000-0000')
      }
    } catch {
      // fallback defaults
    }
  }, [])

  const handleSaveProfile = () => {
    // Mock save — in real app, this would call the backend
    setUserName(`${firstName} ${lastName}`.trim() || 'Admin')
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 3000)
  }

  const handleChangePassword = () => {
    setPasswordError('')
    setPasswordSaved(false)

    if (!currentPassword) {
      setPasswordError('Current password is required')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    // Mock password change
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordSaved(true)
    setTimeout(() => setPasswordSaved(false), 3000)
  }

  // Password strength indicator
  const getPasswordStrength = (pw: string) => {
    if (!pw) return { label: '', color: '', width: '0%' }
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '25%' }
    if (score === 2) return { label: 'Fair', color: 'bg-yellow-500', width: '50%' }
    if (score === 3) return { label: 'Good', color: 'bg-blue-500', width: '75%' }
    return { label: 'Strong', color: 'bg-green-500', width: '100%' }
  }
  
  const strength = getPasswordStrength(newPassword)

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Account Settings</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile and security preferences</p>
      </div>

      {/* ─── Profile Card ──────────────────────────────────── */}
      <Card className="bg-card border-border p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/20 p-2 rounded-lg">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Profile Information</h3>
            <p className="text-xs text-muted-foreground">Update your personal details</p>
          </div>
        </div>

        {/* Avatar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
          <div className="relative shrink-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg sm:text-xl border-2 border-primary/30">
              {firstName ? firstName.charAt(0).toUpperCase() : 'A'}
            </div>
            <button className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-primary rounded-full flex items-center justify-center text-white shadow-lg hover:bg-primary/90 transition-colors">
              <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
            <Badge variant="outline" className="mt-1 bg-primary/20 text-primary border-primary/30 text-[10px]">
              <Shield className="w-3 h-3 mr-1" /> Administrator
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-foreground text-sm">First Name</Label>
            <Input
              placeholder="First name"
              className="mt-1.5 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              value={firstName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-foreground text-sm">Last Name</Label>
            <Input
              placeholder="Last name"
              className="mt-1.5 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
              value={lastName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-foreground text-sm">Email</Label>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground opacity-60"
                value={userEmail}
                readOnly
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Email cannot be changed</p>
          </div>
          <div>
            <Label className="text-foreground text-sm">Phone</Label>
            <div className="relative mt-1.5">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="tel"
                placeholder="+63-000-000-0000"
                className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                value={phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
          {profileSaved && (
            <span className="flex items-center gap-1 text-green-400 text-sm font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
          <Button onClick={handleSaveProfile} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
            Save Changes
          </Button>
        </div>
      </Card>

      {/* ─── Change Password Card ──────────────────────────── */}
      <Card className="bg-card border-border p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-yellow-500/20 p-2 rounded-lg">
            <Lock className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Change Password</h3>
            <p className="text-xs text-muted-foreground">Update your password to keep your account secure</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Current Password */}
          <div>
            <Label className="text-foreground text-sm">Current Password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showCurrent ? 'text' : 'password'}
                placeholder="Enter current password"
                className="pl-10 pr-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                value={currentPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <Label className="text-foreground text-sm">New Password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showNew ? 'text' : 'password'}
                placeholder="Enter new password"
                className="pl-10 pr-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                value={newPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setNewPassword(e.target.value); setPasswordError('') }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Strength meter */}
            {newPassword && (
              <div className="mt-2">
                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                </div>
                <p className={`text-[10px] mt-1 font-medium ${
                  strength.label === 'Weak' ? 'text-red-400' :
                  strength.label === 'Fair' ? 'text-yellow-400' :
                  strength.label === 'Good' ? 'text-blue-400' : 'text-green-400'
                }`}>
                  Password strength: {strength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <Label className="text-foreground text-sm">Confirm New Password</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm new password"
                className="pl-10 pr-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setConfirmPassword(e.target.value); setPasswordError('') }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error / Success */}
          {passwordError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {passwordError}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
          {passwordSaved && (
            <span className="flex items-center gap-1 text-green-400 text-sm font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" /> Password updated
            </span>
          )}
          <Button onClick={handleChangePassword} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
            Update Password
          </Button>
        </div>
      </Card>

      {/* ─── Security Info ──────────────────────────────────── */}
      <Card className="bg-card border-border p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-500/20 p-2 rounded-lg">
            <Shield className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Security</h3>
            <p className="text-xs text-muted-foreground">Account security overview</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 py-2 border-b border-border">
            <span className="text-sm text-foreground">Role</span>
            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs w-fit">Administrator</Badge>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 py-2 border-b border-border">
            <span className="text-sm text-foreground">Two-Factor Authentication</span>
            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs w-fit">Not Enabled</Badge>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-0 py-2">
            <span className="text-sm text-foreground">Last Login</span>
            <span className="text-xs text-muted-foreground font-mono">Feb 16, 2026 — 02:25 PM</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
