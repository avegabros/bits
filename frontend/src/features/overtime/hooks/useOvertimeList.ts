import { useState, useEffect } from 'react';
import { OvertimeRequest } from '../types';
import proxy from '@/proxy';

export function useOvertimeList(role: 'admin' | 'hr' | 'manager', status?: string) {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const url = status ? `/api/attendance/overtime?status=${status}` : '/api/attendance/overtime';
      const response = await proxy.get(url);
      if (response.data.success) {
        setRequests(response.data.requests);
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

  const handleReview = async (id: number, action: 'APPROVED' | 'REJECTED', reason?: string) => {
    try {
      setActionLoading(id);
      const payload: any = { status: action };
      if (action === 'REJECTED' && reason) {
        payload.rejectionReason = reason;
      }
      const response = await proxy.patch(`/api/attendance/overtime/${id}`, payload);
      if (response.data.success) {
        setRequests(prev => prev.map(req => req.id === id ? response.data.request : req));
      }
    } catch (error) {
      console.error('Error reviewing request', error);
    } finally {
      setActionLoading(null);
    }
  };

  return {
    requests,
    loading,
    actionLoading,
    handleReview,
    refresh: fetchRequests
  };
}
