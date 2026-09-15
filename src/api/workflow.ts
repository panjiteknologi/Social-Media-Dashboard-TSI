import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiUsageSummary, JobRun, JobRunDetail } from '../../shared/api';
import { apiGet, apiPost } from './client';

/** Runs shown in Workflow Logs. */
export const RUN_LIMIT = 100;

export function useJobRuns(filters: { job: string; status: string }) {
  const params = new URLSearchParams({ limit: String(RUN_LIMIT) });
  if (filters.job !== 'all') params.set('job', filters.job);
  if (filters.status !== 'all') params.set('status', filters.status);
  return useQuery({
    queryKey: ['workflow', 'runs', filters],
    queryFn: () => apiGet<JobRun[]>(`/jobs/runs?${params}`),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useJobRun(id: string) {
  return useQuery({
    queryKey: ['workflow', 'run', id],
    queryFn: () => apiGet<JobRunDetail>(`/jobs/runs/${id}`),
    // A running job is followed until it finishes.
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 5_000 : false),
  });
}

export function useAiUsage() {
  return useQuery({
    queryKey: ['workflow', 'ai-usage'],
    queryFn: () => apiGet<AiUsageSummary>('/ai/usage'),
    refetchInterval: 60_000,
  });
}

/** Queues a job again with the input of an earlier run. */
export function useRerunJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, input }: { name: string; input: unknown }) =>
      apiPost<{ queueJobId: string }>(`/jobs/${name}/run`, { input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow', 'runs'] });
    },
  });
}
