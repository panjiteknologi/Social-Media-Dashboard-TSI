import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAiBusy } from '../../shared/aiContent';
import type { ContentEvent, ContentInput, ContentItem, ContentStage, TeamMember } from '../../shared/planner';
import { apiDelete, apiGet, apiPost, apiPut } from './client';

const ITEMS_KEY = ['planner', 'items'];

export const toContentInput = (item: ContentItem): ContentInput => ({
  title: item.title,
  type: item.type,
  stage: item.stage,
  keyword: item.keyword,
  campaign: item.campaign,
  priority: item.priority,
  dueDate: item.dueDate,
  ownerId: item.ownerId,
  notes: item.notes,
});

export function useContentItems() {
  return useQuery({
    queryKey: ITEMS_KEY,
    queryFn: () => apiGet<ContentItem[]>('/content'),
    staleTime: 30_000,
    // Cards show the AI writer's progress, so refresh while any task works.
    refetchInterval: (query) => (query.state.data?.some((item) => isAiBusy(item.ai)) ? 5000 : false),
  });
}

export function useContentEvents(id: string | null) {
  return useQuery({
    queryKey: ['planner', 'events', id],
    queryFn: () => apiGet<ContentEvent[]>(`/content/${id}/events`),
    enabled: id !== null,
  });
}

export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: () => apiGet<TeamMember[]>('/users'),
    staleTime: 5 * 60_000,
  });
}

export function useSaveContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: ContentInput }) =>
      id ? apiPut<ContentItem>(`/content/${id}`, input) : apiPost<ContentItem>('/content', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner'] });
    },
  });
}

/** Moves an item to another stage at once on screen, and puts it back if the server refuses. */
export function useMoveContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ item, stage }: { item: ContentItem; stage: ContentStage }) =>
      apiPut<ContentItem>(`/content/${item.id}`, { ...toContentInput(item), stage }),
    onMutate: async ({ item, stage }) => {
      await queryClient.cancelQueries({ queryKey: ITEMS_KEY });
      const previous = queryClient.getQueryData<ContentItem[]>(ITEMS_KEY);
      queryClient.setQueryData<ContentItem[]>(ITEMS_KEY, (items) =>
        items?.map((entry) => (entry.id === item.id ? { ...entry, stage } : entry)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(ITEMS_KEY, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner'] });
    },
  });
}

export function useDeleteContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ deleted: true }>(`/content/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner'] });
    },
  });
}
