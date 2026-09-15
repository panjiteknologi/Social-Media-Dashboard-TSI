import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SeoSettings } from '../../shared/seo';
import { apiGet, apiPost } from './client';

export function useSeoSettings() {
  return useQuery({
    queryKey: ['settings', 'seo'],
    queryFn: () => apiGet<SeoSettings>('/settings/seo'),
  });
}

export function useSaveSeoSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: SeoSettings) => apiPost<SeoSettings>('/settings/seo', settings),
    onSuccess: (saved) => {
      queryClient.setQueryData(['settings', 'seo'], saved);
      // Every SEO number, and the article and traffic numbers joined with it, depends on these settings.
      void queryClient.invalidateQueries({ queryKey: ['seo'] });
      void queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}
