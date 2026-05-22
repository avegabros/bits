import { useState, useEffect, useRef } from 'react';
import { OvertimeRequest } from '../types';
import { apiFetch } from '@/lib/api/client';

export interface OvertimeListFilters {
  search: string;
  departmentId: number | null;
  startDate: string;
  endDate: string;
}

export interface OvertimeListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useOvertimeList(role: 'admin' | 'hr' | 'manager', status?: string, refreshKey: number = 0) {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<OvertimeListMeta | null>(null);
  const [filters, setFilters] = useState<OvertimeListFilters>({
    search: '',
    departmentId: null,
    startDate: '',
    endDate: ''
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset page when filters or status change
  useEffect(() => {
    setPage(1);
  }, [filters, status]);

  const fetchRequests = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '20');
      
      if (status) params.append('status', status);
      if (filters.search) params.append('search', filters.search);
      if (filters.departmentId) params.append('departmentId', filters.departmentId.toString());
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const url = `/api/attendance/overtime?${params.toString()}`;
      
      const response = await apiFetch<{ success: boolean; requests: OvertimeRequest[]; meta: OvertimeListMeta }>(url, {
        signal: abortControllerRef.current.signal
      });
      
      if (response.success) {
        setRequests(response.requests);
        setMeta(response.meta);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Failed to fetch overtime requests', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [page, filters, status, refreshKey]);

  const handleReview = async (id: number, action: 'APPROVED' | 'REJECTED' | 'PENDING', reason?: string) => {
    try {
      setActionLoading(id);
      const payload: any = { status: action };
      if (action === 'REJECTED' && reason) {
        payload.rejectionReason = reason;
      }
      const response = await apiFetch<{ success: boolean; request: OvertimeRequest }>(`/api/attendance/overtime/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      if (response.success) {
        setRequests(prev => prev.map(req => req.id === id ? response.request : req));
      }
    } catch (error) {
      console.error('Error reviewing request', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setActionLoading(id);
      const response = await apiFetch<{ success: boolean }>(`/api/attendance/overtime/${id}`, {
        method: 'DELETE'
      });
      if (response.success) {
        setRequests(prev => prev.filter(req => req.id !== id));
      }
    } catch (error) {
      console.error('Error deleting request', error);
    } finally {
      setActionLoading(null);
    }
  };

  return {
    requests,
    loading,
    actionLoading,
    meta,
    filters,
    setFilters,
    page,
    setPage,
    handleReview,
    handleDelete,
    refresh: fetchRequests
  };
}
