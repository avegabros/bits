'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Holiday {
    id: number;
    name: string;
    date: string;
    description: string | null;
    type: 'REGULAR' | 'SPECIAL';
    createdAt: string;
    updatedAt: string;
}

interface UseHolidaysOptions {
    year?: number;
    month?: number;
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
    }, [options?.year, options?.month]);

    useEffect(() => {
        fetchHolidays();
    }, [fetchHolidays]);

    const createHoliday = async (data: { name: string; date: string; description?: string; type: 'REGULAR' | 'SPECIAL' }) => {
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

    const updateHoliday = async (id: number, data: { name?: string; date?: string; description?: string; type?: 'REGULAR' | 'SPECIAL' }) => {
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
