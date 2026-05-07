'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '@/components/ui/use-toast';

import { SyncConfig } from '../types';

export function useSyncConfig() {
    const [config, setConfig] = useState<SyncConfig | null>(null);
    const [initialConfig, setInitialConfig] = useState<SyncConfig | null>(null);
    const [limits, setLimits] = useState<Record<string, number> | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showIntervalWarning, setShowIntervalWarning] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const [configRes, limitsRes] = await Promise.all([
                    axios.get('/api/system/sync-config', { withCredentials: true }),
                    axios.get('/api/system/validation-limits', { withCredentials: true }).catch(() => ({ data: { success: false } }))
                ]);

                if (configRes.data.success) {
                    setConfig(configRes.data.config);
                    setInitialConfig(configRes.data.config);
                }
                if (limitsRes.data.success) {
                    setLimits(limitsRes.data.limits);
                }
            } catch (error) {
                console.error('Failed to fetch sync config or limits', error);
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, []);

    const saveConfig = useCallback(async () => {
        if (!config) return;
        setSaving(true);
        setShowIntervalWarning(false);
        try {
            const res = await fetch('/api/system/sync-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (data.success) {
                setInitialConfig(config);
                toast({
                    title: 'Configuration Saved',
                    description: data.warning
                        ? `${data.warning}`
                        : 'Sync intervals updated successfully.',
                });
            } else {
                toast({
                    title: 'Error saving config',
                    description: data.message || 'Failed to update configuration',
                    variant: 'destructive',
                });
            }
        } catch (error: unknown) {
            toast({
                title: 'Error saving config',
                description: error instanceof Error ? error.message : 'Failed to update configuration',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    }, [config, toast]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!config) return;

        const errors: string[] = [];
        
        if (config.defaultIntervalSec < (limits?.DEFAULT_INTERVAL_MIN_SEC ?? 10)) {
            errors.push(`Default interval must be at least ${limits?.DEFAULT_INTERVAL_MIN_SEC ?? 10}s`);
        }
        if (config.defaultIntervalSec > (limits?.DEFAULT_INTERVAL_MAX_SEC ?? 86400)) {
            errors.push(`Default interval cannot exceed 24 hours (${limits?.DEFAULT_INTERVAL_MAX_SEC ?? 86400}s)`);
        }
        
        if (config.timeSyncIntervalSec < (limits?.TIME_SYNC_INTERVAL_MIN_SEC ?? 300)) {
            errors.push(`Time sync interval must be at least ${limits?.TIME_SYNC_INTERVAL_MIN_SEC ?? 300}s`);
        }
        if (config.timeSyncIntervalSec > (limits?.TIME_SYNC_INTERVAL_MAX_SEC ?? 86400)) {
            errors.push(`Time sync interval cannot exceed 24 hours (${limits?.TIME_SYNC_INTERVAL_MAX_SEC ?? 86400}s)`);
        }

        if (config.globalMinCheckoutMinutes < (limits?.MIN_CHECKOUT_MIN ?? 15)) {
            errors.push(`Global Minimum Checkout must be at least ${limits?.MIN_CHECKOUT_MIN ?? 15} minutes`);
        }
        if (config.globalMinCheckoutMinutes > (limits?.MIN_CHECKOUT_MAX_MIN ?? 720)) {
            errors.push(`Global Minimum Checkout cannot exceed 12 hours (${limits?.MIN_CHECKOUT_MAX_MIN ?? 720} minutes)`);
        }

        if (config.healthCheckIntervalSec < (limits?.HEALTH_CHECK_INTERVAL_MIN_SEC ?? 15)) {
            errors.push(`Health check interval must be at least ${limits?.HEALTH_CHECK_INTERVAL_MIN_SEC ?? 15}s`);
        }
        if (config.healthCheckIntervalSec > (limits?.HEALTH_CHECK_INTERVAL_MAX_SEC ?? 86400)) {
            errors.push(`Health check interval cannot exceed 24 hours (${limits?.HEALTH_CHECK_INTERVAL_MAX_SEC ?? 86400}s)`);
        }
        
        // Shift-Aware Bounds Check
        const bufferMin = limits?.SHIFT_BUFFER_MIN ?? 0;
        const bufferMax = limits?.SHIFT_BUFFER_MAX ?? 120;
        if (config.shiftBufferMinutes < bufferMin || config.shiftBufferMinutes > bufferMax) {
            errors.push(`Shift Buffer Window must be between ${bufferMin} and ${bufferMax} minutes.`);
        }
        if (config.shiftAwareSyncEnabled && config.highFreqIntervalSec > config.lowFreqIntervalSec) {
            errors.push("Peak Interval (s) must be less than or equal to Off-Peak Interval (s) so polling is faster during rush hours.");
        }
        if (config.highFreqIntervalSec > (limits?.HIGH_FREQ_INTERVAL_MAX_SEC ?? 86400)) {
            errors.push(`Peak Interval cannot exceed 24 hours (${limits?.HIGH_FREQ_INTERVAL_MAX_SEC ?? 86400}s)`);
        }
        if (config.lowFreqIntervalSec > (limits?.LOW_FREQ_INTERVAL_MAX_SEC ?? 86400)) {
            errors.push(`Off-Peak Interval cannot exceed 24 hours (${limits?.LOW_FREQ_INTERVAL_MAX_SEC ?? 86400}s)`);
        }

        if (errors.length > 0) {
            toast({
                title: 'Invalid configuration',
                description: errors.join('\n'),
                variant: 'destructive'
            });
            return;
        }

        // Intercept: if interval is below warning threshold, show warning modal
        if (config.defaultIntervalSec < (limits?.LOW_INTERVAL_WARNING_THRESHOLD ?? 30)) {
            setShowIntervalWarning(true);
            return;
        }

        await saveConfig();
    }, [config, limits, saveConfig, toast]);

    const isDirty = JSON.stringify(config) !== JSON.stringify(initialConfig);

    const handleDiscard = useCallback(() => {
        if (initialConfig) {
            setConfig(initialConfig);
        }
    }, [initialConfig]);

    return {
        config,
        setConfig,
        limits,
        loading,
        saving,
        isDirty,
        showIntervalWarning,
        setShowIntervalWarning,
        saveConfig,
        handleSubmit,
        handleDiscard,
    };
}
