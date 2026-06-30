'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Database, Download, Play, RefreshCw, 
    CheckCircle2, AlertCircle, Clock, FileDown
} from 'lucide-react';

interface BackupFile {
    filename: string;
    size: number;
    createdAt: string;
}

interface BackupStatus {
    dbSize: number;
    backups: BackupFile[];
}

export function DatabaseBackupManagerCard() {
    const [data, setData] = useState<BackupStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [backingUp, setBackingUp] = useState(false);
    const [syncConfig, setSyncConfig] = useState<any>(null);

    // Fetch config & backups list
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [backupsRes, configRes] = await Promise.all([
                axios.get('/api/system/backups', { withCredentials: true }),
                axios.get('/api/system/sync-config', { withCredentials: true })
            ]);

            if (backupsRes.data.success) {
                setData({
                    dbSize: backupsRes.data.dbSize,
                    backups: backupsRes.data.backups
                });
            }
            if (configRes.data.success) {
                setSyncConfig(configRes.data.config);
            }
        } catch (error) {
            console.error('Failed to load database backups or configuration', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleBackupNow = async () => {
        if (backingUp) return;
        setBackingUp(true);
        try {
            const res = await axios.post('/api/system/backups/trigger', {}, { withCredentials: true });
            if (res.data.success) {
                await fetchData();
            }
        } catch (error) {
            console.error('Manual backup failed', error);
            // Refresh data to show error status from DB
            await fetchData();
        } finally {
            setBackingUp(false);
        }
    };

    const handleDownload = (filename: string) => {
        window.open(`/api/system/backups/download/${filename}`, '_blank');
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDateTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) + ' ' + date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    if (loading && !data) {
        return (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="animate-pulse bg-slate-200 w-8 h-8 rounded-lg" />
                    <div className="space-y-2 flex-1">
                        <div className="animate-pulse bg-slate-200 h-4 w-40 rounded" />
                        <div className="animate-pulse bg-slate-200 h-3 w-60 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    const lastBackupAt = syncConfig?.lastBackupAt;
    const lastBackupStatus = syncConfig?.lastBackupStatus;
    const lastBackupError = syncConfig?.lastBackupError;

    return (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 shrink-0">
                        <Database className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                            Database Backup Management
                        </h3>
                        <p className="text-[10px] text-slate-400 font-semibold leading-normal">
                            Manage snapshots, trigger manual backups, and download archives
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                        disabled={loading || backingUp}
                        className="h-8 px-2.5 border-slate-200 text-slate-600"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleBackupNow}
                        disabled={backingUp || loading}
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 font-semibold text-xs transition-colors duration-200"
                    >
                        <Play className={`h-3.5 w-3.5 ${backingUp ? 'animate-pulse' : ''}`} />
                        {backingUp ? 'Backing Up...' : 'Backup Now'}
                    </Button>
                </div>
            </div>

            {/* Status Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 border-b border-slate-100 bg-white">
                {/* DB Size */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 hover:shadow-md hover:bg-white hover:border-slate-300 transition-all duration-300 flex flex-col justify-between min-h-[90px]">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Database Size</span>
                    <span className="text-xl font-black text-slate-800 tracking-tight mt-auto block">
                        {data?.dbSize ? formatBytes(data.dbSize) : 'N/A'}
                    </span>
                </div>

                {/* Last Run Date */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 hover:shadow-md hover:bg-white hover:border-slate-300 transition-all duration-300 flex flex-col justify-between min-h-[90px]">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Last Run</span>
                    <div className="flex items-center gap-1.5 mt-auto">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-sm font-black text-slate-800 truncate">
                            {lastBackupAt ? formatDateTime(lastBackupAt) : 'Never'}
                        </span>
                    </div>
                </div>

                {/* Last Run Status */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 hover:shadow-md hover:bg-white hover:border-slate-300 transition-all duration-300 flex flex-col justify-between min-h-[90px]">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Last Backup Status</span>
                    <div className="mt-auto">
                        {lastBackupStatus === 'success' ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 text-[10px] font-bold py-0.5 px-2 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                SUCCESSFUL
                            </Badge>
                        ) : lastBackupStatus === 'failed' ? (
                            <Badge variant="destructive" className="text-[10px] font-bold py-0.5 px-2 flex items-center gap-1 w-fit">
                                <AlertCircle className="h-3 w-3" />
                                FAILED
                            </Badge>
                        ) : (
                            <Badge className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[10px] font-bold py-0.5 px-2 w-fit">
                                NO HISTORY
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Banner if Last Run Failed */}
            {lastBackupStatus === 'failed' && lastBackupError && (
                <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-red-800">Last Backup Error Output:</p>
                        <p className="text-[11px] text-red-600 mt-0.5 break-all leading-normal">{lastBackupError}</p>
                    </div>
                </div>
            )}

            {/* Backups List Table */}
            <div className="p-5">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Available Backup Files</h3>
                
                {data?.backups && data.backups.length > 0 ? (
                    <>
                        {/* Mobile List View */}
                        <div className="md:hidden divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                            {data.backups.map(b => (
                                <div key={b.filename} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors bg-white">
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="font-semibold text-slate-700 break-all text-xs leading-normal">{b.filename}</p>
                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-slate-400 font-medium">
                                            <span>{formatDateTime(b.createdAt)}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-200" />
                                            <span>{formatBytes(b.size)}</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDownload(b.filename)}
                                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 border border-slate-100 bg-slate-50 hover:bg-slate-100 rounded-md shrink-0 flex items-center justify-center"
                                        title="Download backup file"
                                    >
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-lg">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-semibold">
                                        <th className="p-3">Filename</th>
                                        <th className="p-3">Created Date</th>
                                        <th className="p-3">File Size</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.backups.map(b => (
                                        <tr key={b.filename} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 font-medium text-slate-700 break-all">{b.filename}</td>
                                            <td className="p-3 text-slate-500 whitespace-nowrap">{formatDateTime(b.createdAt)}</td>
                                            <td className="p-3 text-slate-500 whitespace-nowrap">{formatBytes(b.size)}</td>
                                            <td className="p-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDownload(b.filename)}
                                                    className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700 shrink-0"
                                                    title="Download backup file"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="border border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center text-center">
                        <FileDown className="h-8 w-8 text-slate-300 mb-2" />
                        <p className="text-xs font-medium text-slate-600">No backup files found.</p>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-[280px]">Backups will appear here once automatically scheduled or manually run.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
