import { useQuery } from '@tanstack/react-query';
import type { ReportKind, ReportRecord } from '../../shared/reports';
import { apiGet } from './client';

export function useReports(kind: ReportKind) {
  return useQuery({
    queryKey: ['reports', kind],
    queryFn: () => apiGet<ReportRecord[]>(`/reports?kind=${kind}`),
    staleTime: 60_000,
  });
}
