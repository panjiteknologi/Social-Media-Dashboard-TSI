import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AutomationSettings, JobSettingInput } from '../../shared/automation';
import { apiGet, apiPost } from './client';

const KEY = ['settings', 'automation'];

export function useAutomationSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<AutomationSettings>('/settings/automation'),
    // Keeps each job's last run current while the screen is open.
    refetchInterval: 30_000,
  });
}

export function useSaveJobSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, setting }: { name: string; setting: JobSettingInput }) =>
      apiPost<AutomationSettings>(`/settings/automation/${name}`, setting),
    onSuccess: (saved) => queryClient.setQueryData(KEY, saved),
  });
}

export function useRunJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiPost<{ queueJobId: string }>(`/jobs/${name}/run`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useSendTelegramTest() {
  return useMutation({
    mutationFn: () => apiPost<{ sent: true }>('/settings/telegram/test', {}),
  });
}
