import type { QueryInsightsFilters } from '@xata.io/sql';

export const QUERY_INSIGHTS_SORT_BY = {
  'total-time': 'total_exec_time',
  'mean-time': 'mean_exec_time',
  'min-time': 'min_exec_time',
  'max-time': 'max_exec_time',
  'stddev-time': 'stddev_exec_time',
  calls: 'calls',
  rows: 'rows',
  'shared-hit': 'shared_blks_hit',
  'shared-read': 'shared_blks_read',
  'shared-dirtied': 'shared_blks_dirtied',
  'shared-written': 'shared_blks_written',
  'local-hit': 'local_blks_hit',
  'local-read': 'local_blks_read',
  'local-dirtied': 'local_blks_dirtied',
  'local-written': 'local_blks_written',
  'temp-read': 'temp_blks_read',
  'temp-written': 'temp_blks_written',
  database: 'database',
  user: 'user'
} satisfies Record<string, NonNullable<QueryInsightsFilters['sortBy']>>;

export type QueryInsightsSort = keyof typeof QUERY_INSIGHTS_SORT_BY;

export const QUERY_INSIGHTS_SORT_VALUES = Object.keys(QUERY_INSIGHTS_SORT_BY) as QueryInsightsSort[];

export function toQueryInsightsSortBy(sort: QueryInsightsSort): QueryInsightsFilters['sortBy'] {
  return QUERY_INSIGHTS_SORT_BY[sort];
}
