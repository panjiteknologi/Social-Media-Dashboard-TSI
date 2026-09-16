import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DecisionInput } from '../../shared/approvals';
import type { ContentItem } from '../../shared/planner';
import { apiPost } from './client';

/** Approve, request a revision, or reject one piece of content waiting in Review. */
export function useDecideContent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DecisionInput) => apiPost<ContentItem>(`/content/${id}/decision`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner'] });
    },
  });
}
