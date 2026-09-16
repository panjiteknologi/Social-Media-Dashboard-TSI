import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandKnowledge, BrandSettingsResponse } from '../../shared/brand';
import { apiGet, apiPost } from './client';

const KEY = ['settings', 'brand'];

export function useBrandSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<BrandSettingsResponse>('/settings/brand'),
  });
}

export function useSaveBrandSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (knowledge: BrandKnowledge) => apiPost<BrandSettingsResponse>('/settings/brand', knowledge),
    onSuccess: (saved) => queryClient.setQueryData(KEY, saved),
  });
}
