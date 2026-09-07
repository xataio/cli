import {
  checkPgStatStatementsUsable,
  compileSql,
  countQueryInsights as countQueryInsightsQuery,
  getActiveQueries,
  getPgStatStatementsStatus,
  getQueryInsight,
  getQueryInsights,
  PG_STAT_STATEMENTS_EXTENSION,
  resetQueryInsights as resetQueryInsightsQuery,
  type ActiveQuery,
  type QueryInsight,
  type QueryInsightsFilters,
  type RawBuilder,
  type SortDirection
} from '@xata.io/sql';
import type postgres from 'postgres';
import { getErrorMessage } from '~/lib/cli-utils';

export const QUERY_INSIGHTS_ADMIN_DATABASE = 'postgres';

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

export async function executeQuery<T>(sql: postgres.Sql, query: RawBuilder<unknown>) {
  const compiled = compileSql(query);
  return sql.unsafe<T[]>(compiled.sql, compiled.parameters as any[]);
}

export type ListQueryInsightsOptions = {
  search?: string;
  queryTypes: QueryInsightsFilters['queryTypes'];
  performance: QueryInsightsFilters['performanceFilter'];
  databases: string[];
  users: string[];
  sort: QueryInsightsSort;
  direction: SortDirection;
  limit: number;
  offset: number;
};

export async function listQueryInsights(
  sql: postgres.Sql,
  options: ListQueryInsightsOptions
): Promise<{ total: number; rows: QueryInsightRow[] }> {
  const filters = toQueryInsightsFilters(options);
  const rows = await executeQuery<RawQueryInsightRow>(sql, getQueryInsights.fn(filters));
  const total = rows.length > 0 ? Number(rows[0]?.total_count ?? rows.length) : await countQueryInsights(sql, filters);

  return {
    total,
    rows: rows.map((row) => normalizeQueryInsightRow(row))
  };
}

export async function showQueryInsight(
  sql: postgres.Sql,
  queryId: string,
  filters: { db?: string; role?: string } = {}
): Promise<{ row?: QueryInsightRow; ambiguous: boolean }> {
  const rows = await executeQuery<RawQueryInsightRow>(sql, getQueryInsight.fn(queryId, filters));
  if (rows.length > 1) return { ambiguous: true };
  const row = rows[0];
  return { row: row ? normalizeQueryInsightRow(row) : undefined, ambiguous: false };
}

export async function listActiveQueries(sql: postgres.Sql): Promise<ActiveQueryRow[]> {
  return executeQuery<ActiveQueryRow>(sql, getActiveQueries.fn());
}

export async function resetQueryInsights(sql: postgres.Sql) {
  await executeQuery(sql, resetQueryInsightsQuery());
}

async function countQueryInsights(sql: postgres.Sql, filters: QueryInsightsFilters) {
  const rows = await executeQuery<{ total: number }>(sql, countQueryInsightsQuery.fn(filters));
  return Number(rows[0]?.total ?? 0);
}

function toQueryInsightsFilters(options: ListQueryInsightsOptions): QueryInsightsFilters {
  return {
    searchTerm: options.search,
    queryTypes: options.queryTypes,
    performanceFilter: options.performance,
    databaseFilter: options.databases,
    userFilter: options.users,
    sortBy: toQueryInsightsSortBy(options.sort),
    sortDirection: options.direction,
    limit: options.limit,
    offset: options.offset
  };
}

export type PgStatStatementsStatus = {
  available: boolean;
  installed: boolean;
  preloaded: boolean;
  sharedPreloadLibraries: string;
};

export type PgStatStatementsReadiness =
  | { state: 'ready' }
  | { state: 'unavailable' }
  | { state: 'disabled' }
  | { state: 'error'; message: string };

export function resolvePgStatStatementsReadiness(
  status: PgStatStatementsStatus | undefined
): PgStatStatementsReadiness {
  if (!status?.available) return { state: 'unavailable' };
  if (!status.preloaded || !status.installed) return { state: 'disabled' };
  return { state: 'ready' };
}

export async function fetchPgStatStatementsReadiness(sql: postgres.Sql): Promise<PgStatStatementsReadiness> {
  const statusRows = await executeQuery<PgStatStatementsStatus>(sql, getPgStatStatementsStatus.fn());
  const readiness = resolvePgStatStatementsReadiness(statusRows[0]);
  if (readiness.state !== 'ready') return readiness;

  try {
    await executeQuery(sql, checkPgStatStatementsUsable());
  } catch (error) {
    return { state: 'error', message: formatQueryInsightsError(error) };
  }

  return { state: 'ready' };
}

export function formatQueryInsightsError(error: unknown) {
  const message = getErrorMessage(error);
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;

  if (code === '42501' || /permission denied/i.test(message) || /must be superuser/i.test(message)) {
    if (/pg_stat_statements_reset/i.test(message)) {
      return `Permission denied: resetting query insights requires permission to execute pg_stat_statements_reset(). Original error: ${message}`;
    }
    return `Permission denied while accessing query insights. Original error: ${message}`;
  }

  if (message.includes('pg_stat_statements')) {
    return `Query insights require ${PG_STAT_STATEMENTS_EXTENSION} to be enabled on the branch. Original error: ${message}`;
  }
  return message;
}

export function normalizeQueryInsightRow(row: RawQueryInsightRow): QueryInsightRow {
  const normalized: QueryInsightRow = {
    queryid: String(row.queryid),
    query: String(row.query ?? ''),
    calls: toNumber(row.calls),
    total_exec_time: toNumber(row.total_exec_time),
    mean_exec_time: toNumber(row.mean_exec_time),
    min_exec_time: toNumber(row.min_exec_time),
    max_exec_time: toNumber(row.max_exec_time),
    stddev_exec_time: toNumber(row.stddev_exec_time),
    rows: toNumber(row.rows),
    shared_blks_hit: toNumber(row.shared_blks_hit),
    shared_blks_read: toNumber(row.shared_blks_read),
    shared_blks_dirtied: toNumber(row.shared_blks_dirtied),
    shared_blks_written: toNumber(row.shared_blks_written),
    local_blks_hit: toNumber(row.local_blks_hit),
    local_blks_read: toNumber(row.local_blks_read),
    local_blks_dirtied: toNumber(row.local_blks_dirtied),
    local_blks_written: toNumber(row.local_blks_written),
    temp_blks_read: toNumber(row.temp_blks_read),
    temp_blks_written: toNumber(row.temp_blks_written),
    database: String(row.database ?? ''),
    user: String(row.user ?? ''),
    cache_hit_rate: null
  };

  if (row.total_count !== undefined) {
    normalized.total_count = toNumber(row.total_count);
  }
  normalized.cache_hit_rate = calculateCacheHitRate(normalized.shared_blks_hit, normalized.shared_blks_read);
  return normalized;
}

export function calculateCacheHitRate(sharedBlksHit: number, sharedBlksRead: number): number | null {
  const total = sharedBlksHit + sharedBlksRead;
  if (total === 0) return null;
  return (sharedBlksHit / total) * 100;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number(value);
  return 0;
}

export function formatCacheHitRate(rate: number | null | undefined) {
  return rate === null || rate === undefined ? '—' : `${rate.toFixed(1)}%`;
}

export function formatMilliseconds(value: number) {
  if (value < 1) return '0.0ms';
  if (value < 1000) return `${value.toFixed(1)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function truncate(value: string, maxLength: number) {
  if (maxLength <= 0) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export function normalizeQueryForPreview(query: string) {
  return query.replaceAll(/\s+/g, ' ').trim();
}

export type QueryInsightSignal = {
  level: 'warning' | 'critical';
  label: string;
  reason: string;
};

export function getQueryInsightSignals(row: QueryInsightRow): QueryInsightSignal[] {
  const signals: QueryInsightSignal[] = [];
  if (row.mean_exec_time >= 1000) {
    signals.push({
      level: 'critical',
      label: 'slow mean',
      reason: `mean execution time ${formatMilliseconds(row.mean_exec_time)}`
    });
  } else if (row.mean_exec_time >= 100) {
    signals.push({
      level: 'warning',
      label: 'slow mean',
      reason: `mean execution time ${formatMilliseconds(row.mean_exec_time)}`
    });
  }

  if (row.mean_exec_time > 0 && row.max_exec_time >= 1000 && row.max_exec_time >= row.mean_exec_time * 5) {
    signals.push({
      level: 'warning',
      label: 'latency spikes',
      reason: `max ${formatMilliseconds(row.max_exec_time)} is much higher than mean`
    });
  }

  const sharedBlocks = row.shared_blks_hit + row.shared_blks_read;
  if (sharedBlocks >= 100 && row.cache_hit_rate !== null && row.cache_hit_rate !== undefined) {
    if (row.cache_hit_rate < 70) {
      signals.push({
        level: 'critical',
        label: 'low cache hit',
        reason: `cache hit rate ${formatCacheHitRate(row.cache_hit_rate)}`
      });
    } else if (row.cache_hit_rate < 90) {
      signals.push({
        level: 'warning',
        label: 'low cache hit',
        reason: `cache hit rate ${formatCacheHitRate(row.cache_hit_rate)}`
      });
    }
  }

  const tempBlocks = row.temp_blks_read + row.temp_blks_written;
  if (tempBlocks >= 10_000) {
    signals.push({
      level: 'critical',
      label: 'temp I/O',
      reason: `${formatInteger(tempBlocks)} temporary blocks read/written`
    });
  } else if (tempBlocks > 0) {
    signals.push({
      level: 'warning',
      label: 'temp I/O',
      reason: `${formatInteger(tempBlocks)} temporary blocks read/written`
    });
  }

  if (row.calls > 0 && row.rows / row.calls >= 10_000) {
    signals.push({
      level: 'warning',
      label: 'many rows',
      reason: `${formatInteger(Math.round(row.rows / row.calls))} rows per call`
    });
  }

  return signals;
}
