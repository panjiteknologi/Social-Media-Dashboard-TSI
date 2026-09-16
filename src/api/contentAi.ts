import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { isAiBusy, type AiTask, type ContentAiDetail, type TopicsResponse } from '../../shared/aiContent';
import type { ContentItem } from '../../shared/planner';
import { apiGet, apiPost } from './client';

const TOPICS_KEY = ['topics'];

const aiKey = (id: string) => ['planner', 'ai', id];

/** Open topic recommendations; polls while a run the user started is still going. */
export function useTopics(poll: boolean) {
  return useQuery({
    queryKey: TOPICS_KEY,
    queryFn: () => apiGet<TopicsResponse>('/topics'),
    refetchInterval: poll ? 5000 : false,
  });
}

export function useRunTopics() {
  return useMutation({ mutationFn: () => apiPost<{ queued: true }>('/topics/run') });
}

export function usePlanTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<ContentItem>(`/topics/${id}/plan`),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TOPICS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['planner'] });
    },
  });
}

export function useDismissTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ dismissed: true }>(`/topics/${id}/dismiss`),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TOPICS_KEY });
    },
  });
}

/**
 * An item's brief, draft and QA. Polls while a task works, and refreshes the
 * planner when it finishes, since a finished task can move the item's stage.
 */
export function useContentAi(id: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: aiKey(id),
    queryFn: () => apiGet<ContentAiDetail>(`/content/${id}/ai`),
    refetchInterval: (current) => (current.state.data && isAiBusy(current.state.data.summary) ? 4000 : false),
  });

  const busy = query.data ? isAiBusy(query.data.summary) : false;
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy) {
      void queryClient.invalidateQueries({ queryKey: ['planner', 'items'] });
      void queryClient.invalidateQueries({ queryKey: ['planner', 'events', id] });
    }
    wasBusy.current = busy;
  }, [busy, id, queryClient]);

  return query;
}

export function useQueueAiTask(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: AiTask) => apiPost<ContentAiDetail>(`/content/${id}/ai`, { task }),
    onSuccess: (detail) => {
      queryClient.setQueryData(aiKey(id), detail);
      void queryClient.invalidateQueries({ queryKey: ['planner', 'items'] });
    },
  });
}
