import { useQuery } from '@tanstack/react-query';
import type { LeadDetail, LeadsResponse } from '../../shared/leads';
import { apiGet } from './client';

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: () => apiGet<LeadsResponse>('/leads'),
    staleTime: 60_000,
    // The bell shows new leads without anyone reloading the page.
    refetchInterval: 60_000,
  });
}

/**
 * What one person wrote, read from the CMS only while their lead is open.
 * It is never cached beyond this session's view, and never stored on the server.
 */
export function useLeadDetail(id: number | null) {
  return useQuery({
    queryKey: ['leads', 'detail', id],
    queryFn: () => apiGet<LeadDetail>(`/leads/${id}/detail`),
    enabled: id !== null,
    gcTime: 0,
    staleTime: 0,
  });
}
