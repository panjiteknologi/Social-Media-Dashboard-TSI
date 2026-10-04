import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConnectRequest,
  ConnectSelection,
  SocialConnectOptions,
  SocialOverview,
} from '../../shared/social';
import { apiDelete, apiGet, apiPost } from './client';

const OVERVIEW_KEY = ['social', 'overview'];

export function useSocialOverview() {
  return useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: () => apiGet<SocialOverview>('/social/overview'),
  });
}

/** Which login buttons this server offers. */
export function useConnectOptions() {
  return useQuery({
    queryKey: ['social', 'options'],
    queryFn: () => apiGet<SocialConnectOptions>('/social/options'),
  });
}

export function useConnectWithToken() {
  return useMutation({
    mutationFn: (accessToken: string) => apiPost<{ id: string }>('/social/meta/token', { accessToken }),
  });
}

export function useConnectRequest(id: string | null) {
  return useQuery({
    queryKey: ['social', 'connect', id],
    queryFn: () => apiGet<ConnectRequest>(`/social/connect/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

/** Followers and the capability states change together once an account is added or removed. */
function useRefreshSocial() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    void queryClient.invalidateQueries({ queryKey: ['capabilities'] });
  };
}

export function useCompleteConnect() {
  const refresh = useRefreshSocial();
  return useMutation({
    mutationFn: ({ id, selections }: { id: string; selections: ConnectSelection[] }) =>
      apiPost<{ connected: number }>(`/social/connect/${id}`, { selections }),
    onSuccess: refresh,
  });
}

export function useDisconnectAccount() {
  const refresh = useRefreshSocial();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: true }>(`/social/accounts/${id}`),
    onSuccess: refresh,
  });
}

export function useRefreshFollowers() {
  const refresh = useRefreshSocial();
  return useMutation({
    mutationFn: () => apiPost<{ queueJobId: string }>('/social/refresh', {}),
    // The worker needs a few seconds to ask Meta; look again once it has.
    onSuccess: () => setTimeout(refresh, 6000),
  });
}
