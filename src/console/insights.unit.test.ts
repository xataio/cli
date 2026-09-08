import { describe, expect, test } from 'bun:test';
import type { QueryInsightRow } from '~/lib/query-insights';
import { insightSeverityColor, wrapText } from './insights';

function buildRow(overrides: Partial<QueryInsightRow> = {}): QueryInsightRow {
  return {
    queryid: '123',
    query: 'select 1',
    calls: 10,
    total_exec_time: 100,
    mean_exec_time: 10,
    min_exec_time: 1,
    max_exec_time: 20,
    stddev_exec_time: 2,
    rows: 10,
    shared_blks_hit: 0,
    shared_blks_read: 0,
    shared_blks_dirtied: 0,
    shared_blks_written: 0,
    local_blks_hit: 0,
    local_blks_read: 0,
    local_blks_dirtied: 0,
    local_blks_written: 0,
    temp_blks_read: 0,
    temp_blks_written: 0,
    database: 'app',
    user: 'app_user',
    cache_hit_rate: null,
    ...overrides
  };
}

describe('console insights helpers', () => {
  test('insightSeverityColor maps signal levels to colors', () => {
    expect(insightSeverityColor(buildRow())).toBeUndefined();
    expect(insightSeverityColor(buildRow({ mean_exec_time: 150 }))).toBe('yellow');
    expect(insightSeverityColor(buildRow({ mean_exec_time: 2000 }))).toBe('red');
  });

  test('wrapText wraps long lines and preserves line breaks', () => {
    expect(wrapText('abcdef', 3)).toEqual(['abc', 'def']);
    expect(wrapText('ab\n\ncd', 10)).toEqual(['ab', '', 'cd']);
    expect(wrapText('abc', 0)).toEqual(['abc']);
  });
});
