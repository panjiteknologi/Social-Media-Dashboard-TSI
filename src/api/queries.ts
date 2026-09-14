import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CurrentUser } from '../../shared/api';
import type { CapabilityStates } from '../../shared/capabilities';
import { apiGet, apiPost, isUnauthorized } from './client';

const FIVE_MINUTES_MS = 5 * 60_000;

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<CurrentUser>('/me'),
    staleTime: FIVE_MINUTES_MS,
    // Being signed out is an answer, not a transient failure worth retrying.
    retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 2,
  });
}

export function useCapabilities() {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: () => apiGet<CapabilityStates>('/capabilities'),
    staleTime: FIVE_MINUTES_MS,
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ ok: true }>('/auth/logout'),
    onSettled: () => {
      queryClient.clear();
      window.location.assign('/');
    },
  });
}
