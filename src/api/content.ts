import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AnalyticsOverview, ArticlesResponse } from '../../shared/content';
import type { ChartRange } from '../../shared/seo';
import { apiGet } from './client';

/** Articles and leads sync hourly and traffic daily, so a few minutes of caching costs nothing. */
const STALE_MS = 5 * 60_000;

export function useArticles() {
  return useQuery({
    queryKey: ['content', 'articles'],
    queryFn: () => apiGet<ArticlesResponse>('/articles'),
    staleTime: STALE_MS,
  });
}

export function useAnalyticsOverview(range: ChartRange) {
  return useQuery({
    queryKey: ['content', 'analytics', range],
    queryFn: () => apiGet<AnalyticsOverview>(`/analytics/overview?range=${range}`),
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}
