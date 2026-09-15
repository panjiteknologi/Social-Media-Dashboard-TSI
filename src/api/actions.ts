import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActionStatus, SeoAction, SeoActionsResponse } from '../../shared/actions';
import { apiGet, apiPost } from './client';

export function useSeoActions() {
  return useQuery({
    queryKey: ['seo', 'actions'],
    queryFn: () => apiGet<SeoActionsResponse>('/seo/actions'),
    staleTime: 60_000,
  });
}

export function useUpdateActionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ActionStatus }) =>
      apiPost<SeoAction>(`/seo/actions/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['seo', 'actions'] });
    },
  });
}
