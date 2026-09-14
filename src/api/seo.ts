import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ChartRange, SeoKeywords, SeoOverview } from '../../shared/seo';
import { apiGet } from './client';

/** Search data changes once a day, so a few minutes of caching costs nothing. */
const STALE_MS = 5 * 60_000;

export function useSeoOverview(range: ChartRange) {
  return useQuery({
    queryKey: ['seo', 'overview', range],
    queryFn: () => apiGet<SeoOverview>(`/seo/overview?range=${range}`),
    staleTime: STALE_MS,
    // Switching range keeps the current chart on screen, dimmed, instead of flashing empty.
    placeholderData: keepPreviousData,
  });
}

export function useSeoKeywords() {
  return useQuery({
    queryKey: ['seo', 'keywords'],
    queryFn: () => apiGet<SeoKeywords>('/seo/keywords'),
    staleTime: STALE_MS,
  });
}
