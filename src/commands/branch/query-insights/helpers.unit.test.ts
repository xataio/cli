import { describe, expect, test } from 'bun:test';
import { parsePerformanceCategories, parseQueryTypes, parseStringFilter } from './filters';
import { calculateCacheHitRate, normalizeQueryInsightRow } from './normalize';
import { QUERY_INSIGHTS_SORT_VALUES, toQueryInsightsSortBy } from './sort';

describe('query insights helpers', () => {
  test('parses comma-separated filters', () => {
    expect(parseStringFilter(' app, postgres ,, analytics ')).toEqual(['app', 'postgres', 'analytics']);
    expect(parseQueryTypes('select,UPDATE')).toEqual(['SELECT', 'UPDATE']);
    expect(parsePerformanceCategories('FAST,slow')).toEqual(['fast', 'slow']);
  });

  test('rejects invalid enum filters', () => {
    expect(() => parseQueryTypes('SELECT,UPSERT')).toThrow('Invalid query type: UPSERT');
    expect(() => parsePerformanceCategories('fast,bad')).toThrow('Invalid performance category: bad');
  });

  test('normalizes query insight rows and derives cache hit rate', () => {
    const row = normalizeQueryInsightRow({
      queryid: 123n,
      query: 'select 1',
      calls: '10',
      total_exec_time: '250.5',
      mean_exec_time: '25.05',
      min_exec_time: 1n,
      max_exec_time: '100',
      stddev_exec_time: undefined,
      rows: '200',
      shared_blks_hit: '75',
      shared_blks_read: '25',
      shared_blks_dirtied: undefined,
      shared_blks_written: undefined,
      local_blks_hit: undefined,
      local_blks_read: undefined,
      local_blks_dirtied: undefined,
      local_blks_written: undefined,
      temp_blks_read: undefined,
      temp_blks_written: undefined,
      database: 'app',
      user: 'postgres',
      total_count: '5'
    });

    expect(row.queryid).toBe('123');
    expect(row.calls).toBe(10);
    expect(row.total_exec_time).toBe(250.5);
    expect(row.min_exec_time).toBe(1);
    expect(row.stddev_exec_time).toBe(0);
    expect(row.total_count).toBe(5);
    expect(row.cache_hit_rate).toBe(75);
  });

  test('calculates cache hit rate only when block totals are non-zero', () => {
    expect(calculateCacheHitRate(0, 0)).toBeNull();
    expect(calculateCacheHitRate(9, 1)).toBe(90);
  });

  test('keeps CLI sort values mapped to canonical SQL sort fields', () => {
    expect(QUERY_INSIGHTS_SORT_VALUES).toContain('total-time');
    expect(toQueryInsightsSortBy('total-time')).toBe('total_exec_time');
    expect(toQueryInsightsSortBy('shared-hit')).toBe('shared_blks_hit');
    expect(toQueryInsightsSortBy('database')).toBe('database');
  });
});
