import React from 'react'
import {
    LogIn, LogOut, Fingerprint, Clock, Radio, KeyRound, Bot,
    Wifi, WifiOff, Copy, AlertTriangle, FileText, ClipboardCheck,
    ClipboardX, UserPlus, Trash2, Edit, Shield, RefreshCw
} from 'lucide-react'

export const formatTimestamp = (ts: string) => {
    const d = new Date(ts)
    return {
        date: d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
}

export const formatActionLabel = (action: string) => {
    return action.replace(/_/g, ' ')
}

export const getActionIcon = (action: string) => {
    const a = action.toUpperCase()
    if (a.includes('CHECK_IN') || a === 'CHECK IN') return <LogIn className="w-4 h-4 text-emerald-600" />
    if (a.includes('CHECK_OUT') || a === 'CHECK OUT') return <LogOut className="w-4 h-4 text-blue-600" />
    if (a === 'LOGIN') return <LogIn className="w-4 h-4 text-emerald-600" />
    if (a === 'FAILED_LOGIN') return <LogIn className="w-4 h-4 text-red-500" />
    if (a === 'LOGOUT') return <LogOut className="w-4 h-4 text-slate-500" />
    if (a === 'DEVICE SCAN') return <Fingerprint className="w-4 h-4 text-slate-500" />
    if (a === 'DEVICE_CONNECT') return <Wifi className="w-4 h-4 text-emerald-500" />
    if (a === 'DEVICE_DISCONNECT') return <WifiOff className="w-4 h-4 text-red-500" />
    if (a === 'DUPLICATE_PUNCH') return <Copy className="w-4 h-4 text-amber-500" />
    if (a === 'SUSPICIOUS_CHECKOUT') return <AlertTriangle className="w-4 h-4 text-orange-500" />
    if (a === 'ADJUSTMENT_SUBMIT') return <FileText className="w-4 h-4 text-blue-500" />
    if (a === 'ADJUSTMENT_APPROVE') return <ClipboardCheck className="w-4 h-4 text-emerald-500" />
    if (a === 'ADJUSTMENT_REJECT') return <ClipboardX className="w-4 h-4 text-red-500" />
    if (a === 'CREATE') return <UserPlus className="w-4 h-4 text-emerald-600" />
    if (a === 'UPDATE') return <Edit className="w-4 h-4 text-blue-600" />
    if (a === 'DELETE') return <Trash2 className="w-4 h-4 text-red-600" />
    if (a === 'STATUS_CHANGE') return <Shield className="w-4 h-4 text-amber-600" />
    if (a === 'AUTO_CHECKOUT') return <Bot className="w-4 h-4 text-violet-600" />
    if (a === 'FLAG_MISSING_CHECKOUT') return <Bot className="w-4 h-4 text-orange-500" />
    if (a === 'EXPORT') return <FileText className="w-4 h-4 text-indigo-500" />
    if (a === 'SYNC') return <RefreshCw className="w-4 h-4 text-sky-500" />
    return <Clock className="w-4 h-4 text-slate-400" />
}

export const getActionBadge = (action: string) => {
    const a = action.toUpperCase()
    if (a.includes('CHECK_IN') || a === 'CHECK IN' || a === 'CREATE' || a === 'LOGIN' || a === 'DEVICE_CONNECT' || a === 'ADJUSTMENT_APPROVE') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (a.includes('CHECK_OUT') || a === 'CHECK OUT' || a === 'UPDATE' || a === 'SYNC' || a === 'ADJUSTMENT_SUBMIT') return 'bg-blue-50 text-blue-700 border-blue-200'
    if (a === 'DELETE' || a === 'FAILED_LOGIN' || a === 'DEVICE_DISCONNECT' || a === 'ADJUSTMENT_REJECT') return 'bg-red-50 text-red-700 border-red-200'
    if (a === 'STATUS_CHANGE' || a === 'DUPLICATE_PUNCH') return 'bg-amber-50 text-amber-700 border-amber-200'
    if (a === 'SUSPICIOUS_CHECKOUT') return 'bg-orange-50 text-orange-700 border-orange-200'
    if (a === 'AUTO_CHECKOUT' || a === 'FLAG_MISSING_CHECKOUT') return 'bg-violet-50 text-violet-700 border-violet-200'
    if (a === 'EXPORT') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    if (a === 'LOGOUT') return 'bg-slate-50 text-slate-600 border-slate-200'
    return 'bg-slate-50 text-slate-600 border-slate-200'
}

export const getLevelBadge = (level?: string) => {
    if (level === 'ERROR') return 'bg-red-50 text-red-700 border-red-200'
    if (level === 'WARN') return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-slate-50 text-slate-600 border-slate-200'
}

export const getCategoryBadge = (category?: string) => {
    const c = category?.toLowerCase()
    if (c === 'attendance') return 'bg-violet-50 text-violet-700 border-violet-200'
    if (c === 'auth') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (c === 'device') return 'bg-sky-50 text-sky-700 border-sky-200'
    if (c === 'employee') return 'bg-amber-50 text-amber-700 border-amber-200'
    if (c === 'config') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    if (c === 'system') return 'bg-slate-50 text-slate-600 border-slate-200'
    return 'bg-slate-50 text-slate-600 border-slate-200'
}

export const getAvatarBg = (role?: string) => {
    const r = role?.toUpperCase();
    if (!r || r === 'SYSTEM') return 'bg-gradient-to-br from-slate-400 to-slate-500'
    if (r === 'ADMIN') return 'bg-gradient-to-br from-blue-500 to-indigo-600'
    if (r === 'HR') return 'bg-gradient-to-br from-emerald-500 to-teal-600'
    if (r === 'USER' || r === 'EMPLOYEE') return 'bg-gradient-to-br from-amber-500 to-orange-600'
    return 'bg-gradient-to-br from-slate-400 to-slate-500'
}
