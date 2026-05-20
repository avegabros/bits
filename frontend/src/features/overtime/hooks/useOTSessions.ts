import { useState, useEffect, useRef } from 'react';
import { OTSession } from '../types';
import { apiFetch } from '@/lib/api/client';

export interface OTSessionFilters {
  search: string;
  departmentId: number | null;
  startDate: string;
  endDate: string;
  sessionState: string;
}

export interface OTSessionMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useOTSessions() {
  const [sessions, setSessions] = useState<OTSession[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<OTSessionMeta | null>(null);
  const [filters, setFilters] = useState<OTSessionFilters>({
    search: '',
    departmentId: null,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    sessionState: ''
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const fetchSessions = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      
      if (filters.search) params.append('search', filters.search);
      if (filters.departmentId) params.append('departmentId', filters.departmentId.toString());
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.sessionState) params.append('sessionState', filters.sessionState);

      const url = `/api/attendance/overtime/sessions?${params.toString()}`;
      
      const response = await apiFetch<{ success: boolean; sessions: OTSession[]; meta: OTSessionMeta }>(url, {
        signal: abortControllerRef.current.signal
      });
      
      if (response.success) {
        setSessions(response.sessions);
        setMeta(response.meta);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Failed to fetch overtime sessions', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [page, filters]);

  return {
    sessions,
    loading,
    meta,
    filters,
    setFilters,
    page,
    setPage,
    refresh: fetchSessions
  };
}
