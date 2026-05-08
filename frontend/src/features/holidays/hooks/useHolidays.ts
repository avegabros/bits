'use client';

import { useState, useEffect, useCallback } from 'react';

export interface HolidayBranchInfo {
    branchId: number;
    branch: { id: number; name: string };
}

export interface Holiday {
    id: number;
    name: string;
    date: string;
    description: string | null;
    type: 'REGULAR' | 'SPECIAL';
    createdAt: string;
    updatedAt: string;
    branches: HolidayBranchInfo[];
}

interface UseHolidaysOptions {
    year?: number;
    month?: number;
    branchId?: number;
}

export function useHolidays(options?: UseHolidaysOptions) {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHolidays = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (options?.year) params.set('year', String(options.year));
            if (options?.month) params.set('month', String(options.month));
            if (options?.branchId) params.set('branchId', String(options.branchId));

            const qs = params.toString();
            const res = await fetch(`/api/holidays${qs ? `?${qs}` : ''}`, { credentials: 'include' });
            const data = await res.json();

            if (data.success) {
                setHolidays(data.holidays);
                setError(null);
            } else {
                setError(data.message || 'Failed to fetch holidays');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch holidays');
        } finally {
            setLoading(false);
        }
    }, [options?.year, options?.month, options?.branchId]);

    useEffect(() => {
        fetchHolidays();
    }, [fetchHolidays]);

    const createHoliday = async (data: { name: string; date: string; description?: string; type: 'REGULAR' | 'SPECIAL'; branchIds?: number[] }) => {
        const res = await fetch('/api/holidays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        await fetchHolidays();
        return result.holiday;
    };

    const updateHoliday = async (id: number, data: { name?: string; date?: string; description?: string; type?: 'REGULAR' | 'SPECIAL'; branchIds?: number[] }) => {
        const res = await fetch(`/api/holidays/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        await fetchHolidays();
        return result.holiday;
    };

    const deleteHoliday = async (id: number) => {
        const res = await fetch(`/api/holidays/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        await fetchHolidays();
    };

    return {
        holidays,
        loading,
        error,
        refetch: fetchHolidays,
        createHoliday,
        updateHoliday,
        deleteHoliday,
    };
}

/**
 * Utility: build a Set of date strings (YYYY-MM-DD) from holidays array.
 * Used by attendance views to quickly check if a date is a holiday.
 */
export function buildHolidayDateSet(holidays: Holiday[]): Map<string, Holiday> {
    const map = new Map<string, Holiday>();
    for (const h of holidays) {
        const dateStr = new Date(h.date).toISOString().split('T')[0];
        map.set(dateStr, h);
    }
    return map;
}

/**
 * Utility: check if a holiday applies to a given branchId.
 * A holiday with no branch assignments is national (applies to all).
 * A holiday with branch assignments only applies to those branches.
 */
export function holidayAppliesToBranch(holiday: Holiday, branchId: number | null | undefined): boolean {
    if (!holiday.branches || holiday.branches.length === 0) return true; // National
    if (!branchId) return true; // If employee has no branch, treat all holidays as applying
    return holiday.branches.some(b => b.branchId === branchId);
}
