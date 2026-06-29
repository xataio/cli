import {
  countQueryInsights as countQueryInsightsQuery,
  getActiveQueries,
  getQueryInsight,
  getQueryInsights,
  resetQueryInsights as resetQueryInsightsQuery,
  type QueryInsightsFilters
} from '@xata.io/sql';
import type postgres from 'postgres';
import { normalizeQueryInsightRow } from './normalize';
import { executeQuery } from './shared';
import { toQueryInsightsSortBy, type QueryInsightsSort } from './sort';
import type { ActiveQueryRow, QueryInsightRow, RawQueryInsightRow, SortDirection } from './types';

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
