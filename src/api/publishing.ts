import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublishSummary } from '../../shared/publishing';
import { apiPost } from './client';

/**
 * Sends one approved article to the website CMS as a draft. `force` writes it
 * even though the CMS already holds an article with the same title.
 */
export function usePublishContent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (force: boolean) => apiPost<PublishSummary>(`/content/${id}/publish`, { force }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner'] });
    },
  });
}
