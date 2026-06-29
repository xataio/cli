import {
  PERFORMANCE_CATEGORIES,
  QUERY_TYPES,
  type ActiveQuery,
  type PerformanceCategory,
  type QueryInsight,
  type QueryType,
  type SortDirection
} from '@xata.io/sql';

export { PERFORMANCE_CATEGORIES, QUERY_TYPES };
export type { PerformanceCategory, QueryType, SortDirection };
export type { QueryInsightsSort } from './sort';

export type RawQueryInsightRow = Record<string, unknown>;

export type QueryInsightRow = QueryInsight & {
  total_count?: number;
  cache_hit_rate: number | null;
};

export type ActiveQueryRow = Omit<ActiveQuery, 'backend_start' | 'xact_start' | 'query_start' | 'state_change'> & {
  backend_start: Date | string;
  xact_start: Date | string | null;
  query_start: Date | string;
  state_change: Date | string;
};
