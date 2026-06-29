import type { QueryInsightRow, RawQueryInsightRow } from './types';

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
