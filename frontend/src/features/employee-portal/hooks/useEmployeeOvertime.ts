import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import { OvertimeRequest } from '@/features/overtime/types';

export function useEmployeeOvertime() {
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      // Since the logged-in user is an employee (USER role), the backend 
      // automatically scopes the result to their own requests.
      const response = await apiFetch<{ success: boolean; requests: OvertimeRequest[] }>('/api/attendance/overtime');
      if (response.success) {
        setRequests(response.requests);
      }
    } catch (error) {
      console.error('Failed to fetch employee overtime requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, refresh: fetchRequests };
}
