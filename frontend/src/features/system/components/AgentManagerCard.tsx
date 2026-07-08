'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Power, RefreshCw, AlertCircle, Check, Copy, ShieldCheck, Cpu, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BranchAgent {
    id: number;
    branchId: number;
    branchName: string;
    label: string;
    isEnabled: boolean;
    status: 'ONLINE' | 'OFFLINE';
    lastHeartbeatAt: string | null;
    lastConnectedAt: string | null;
    lastDisconnectedAt: string | null;
    agentVersion: string | null;
    metadata: any;
    createdAt: string;
}

interface Branch {
    id: number;
    name: string;
}

export function AgentManagerCard() {
    const [agents, setAgents] = useState<BranchAgent[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [branchesLoading, setBranchesLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    // Form registration state
    const [label, setLabel] = useState('');
    const [branchId, setBranchId] = useState('');
    const [registering, setRegistering] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [deletingAgent, setDeletingAgent] = useState<BranchAgent | null>(null);

    const fetchAgents = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/devices/agents', { withCredentials: true });
            if (res.data.success) {
                setAgents(res.data.agents);
            }
        } catch (error: any) {
            console.error('Failed to fetch agents:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchBranches = useCallback(async () => {
        setBranchesLoading(true);
        try {
            const res = await axios.get('/api/branches', { withCredentials: true });
            if (res.data.success) {
                setBranches(res.data.branches);
            }
        } catch (error: any) {
            console.error('Failed to fetch branches:', error);
        } finally {
            setBranchesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAgents();
        fetchBranches();
    }, [fetchAgents, fetchBranches]);

    const handleRegisterAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!label.trim()) {
            setErrorMessage('Agent label is required');
            return;
        }
        if (!branchId) {
            setErrorMessage('Please select a branch assignment');
            return;
        }

        setRegistering(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        setGeneratedToken(null);
        setCopied(false);

        try {
            const res = await axios.post('/api/devices/agents', {
                label: label.trim(),
                branchId: Number(branchId)
            }, { withCredentials: true });

            if (res.data.success) {
                setSuccessMessage(res.data.message);
                setGeneratedToken(res.data.rawToken);
                setLabel('');
                setBranchId('');
                fetchAgents();
            } else {
                setErrorMessage(res.data.message || 'Registration failed');
            }
        } catch (error: any) {
            setErrorMessage(error.response?.data?.message || 'Failed to connect to backend server');
        } finally {
            setRegistering(false);
        }
    };

    const handleToggleAgent = async (agent: BranchAgent) => {
        setActionLoading(agent.id);
        try {
            const res = await axios.post(`/api/devices/agents/${agent.id}/toggle`, {
                enabled: !agent.isEnabled
            }, { withCredentials: true });
            if (res.data.success) {
                setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, isEnabled: res.data.agent.isEnabled } : a));
            }
        } catch (error: any) {
            alert(error.response?.data?.message || 'Action failed');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteAgent = async (agent: BranchAgent) => {
        setActionLoading(agent.id);
        try {
            const res = await axios.delete(`/api/devices/agents/${agent.id}`, { withCredentials: true });
            if (res.data.success) {
                setAgents(prev => prev.filter(a => a.id !== agent.id));
                setDeletingAgent(null);
            }
        } catch (error: any) {
            setErrorMessage(error.response?.data?.message || 'Delete failed');
        } finally {
            setActionLoading(null);
        }
    };

    const copyToClipboard = () => {
        if (!generatedToken) return;
        navigator.clipboard.writeText(generatedToken);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="bg-card border-border overflow-hidden p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Cpu className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Local Branch Agents</h2>
                        <p className="text-xs text-muted-foreground">Manage background sync daemons deployed at local offices</p>
                    </div>
                </div>
                <div>
                    <Button variant="outline" size="sm" onClick={fetchAgents} disabled={loading} className="gap-2 border-border">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Token display alert */}
            {generatedToken && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 p-4 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="flex items-start gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm">Security Token Generated Successfully!</p>
                            <p className="text-xs text-emerald-600 mt-0.5">Copy this token to the agent's <code className="bg-emerald-500/20 px-1 py-0.5 rounded font-mono font-bold text-emerald-800">.env</code> configuration under <code className="bg-emerald-500/20 px-1 py-0.5 rounded font-mono font-bold text-emerald-800">BRANCH_AGENT_TOKEN</code>.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            value={generatedToken}
                            className="bg-card border border-emerald-500/30 text-xs font-mono font-bold rounded-lg px-3 py-2 outline-none w-full text-foreground"
                        />
                        <Button size="sm" onClick={copyToClipboard} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0">
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Copied' : 'Copy'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleRegisterAgent} className="bg-secondary/10 rounded-xl p-4 border border-border/60 space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Register Branch Agent</h3>
                {errorMessage && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {errorMessage}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Agent Label</label>
                        <Input
                            placeholder="e.g. Cebu Branch Server"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            className="bg-secondary/40 border-border text-sm h-9"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Branch Assignment</label>
                        <select
                            value={branchId}
                            onChange={e => setBranchId(e.target.value)}
                            className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-sm h-9 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-foreground"
                        >
                            <option value="">Select Branch</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <Button type="submit" disabled={registering} className="w-full h-9 bg-primary hover:bg-primary/90 text-sm font-bold gap-2">
                            {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Register Agent
                        </Button>
                    </div>
                </div>
            </form>

            {/* List */}
            <div className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Registrations</h3>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : agents.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-border rounded-xl text-sm text-muted-foreground">
                        No branch agents registered. Register an agent above to sync remote branch devices.
                    </div>
                ) : (
                    <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                        {agents.map(agent => (
                            <div key={agent.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-secondary/5 transition-colors">
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-foreground text-sm">{agent.label}</span>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            agent.isEnabled
                                                ? agent.status === 'ONLINE'
                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                : 'bg-secondary text-muted-foreground border border-border'
                                        }`}>
                                            <span className={`w-1 h-1 rounded-full ${
                                                agent.isEnabled
                                                    ? agent.status === 'ONLINE'
                                                        ? 'bg-emerald-500 animate-pulse'
                                                        : 'bg-amber-500'
                                                    : 'bg-slate-400'
                                            }`} />
                                            {agent.isEnabled ? agent.status : 'DISABLED'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                        <span>Branch: <strong className="text-foreground">{agent.branchName}</strong></span>
                                        {agent.lastHeartbeatAt && (
                                            <span>Active: <strong>{formatDistanceToNow(new Date(agent.lastHeartbeatAt), { addSuffix: true })}</strong></span>
                                        )}
                                        {agent.agentVersion && (
                                            <span>v{agent.agentVersion}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={actionLoading === agent.id}
                                        onClick={() => handleToggleAgent(agent)}
                                        className={`gap-1.5 h-8 text-xs border-border ${agent.isEnabled ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                                    >
                                        <Power className="w-3.5 h-3.5" />
                                        {agent.isEnabled ? 'Disable' : 'Enable'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={actionLoading === agent.id}
                                        onClick={() => setDeletingAgent(agent)}
                                        className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 h-8 px-2.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Delete Confirmation Modal */}
            {deletingAgent && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 text-center space-y-4">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto animate-pulse">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-bold text-foreground text-base">Delete Branch Agent?</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Are you sure you want to delete <strong className="text-foreground">{deletingAgent.label}</strong>? This will permanently revoke its tokens and disconnect any associated devices.
                                </p>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setDeletingAgent(null)}
                                    className="flex-1 border-border text-foreground hover:bg-secondary/50 h-9"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => handleDeleteAgent(deletingAgent)}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-9"
                                    disabled={actionLoading === deletingAgent.id}
                                >
                                    {actionLoading === deletingAgent.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                    ) : (
                                        'Delete'
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}
