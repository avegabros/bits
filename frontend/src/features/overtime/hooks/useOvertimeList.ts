import { useState, useEffect } from 'react';
import { OvertimeRequest } from '../types';
import { apiFetch } from '@/lib/api/client';

export function useOvertimeList(role: 'admin' | 'hr' | 'manager', status?: string) {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const url = status ? `/api/attendance/overtime?status=${status}` : '/api/attendance/overtime';
      const response = await apiFetch<{ success: boolean; requests: OvertimeRequest[] }>(url);
      if (response.success) {
        setRequests(response.requests);
      }
    } catch (error) {
      console.error('Failed to fetch overtime requests', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [status]);

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
    handleReview,
    handleDelete,
    refresh: fetchRequests
  };
}
