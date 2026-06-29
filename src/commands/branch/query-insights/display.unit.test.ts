import { describe, expect, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { getQueryInsightSignals, renderQueryInsightDetails, renderQueryInsightsTable } from './display';
import type { QueryInsightRow } from './types';

function buildContext(columns = 200) {
  return {
    process: {
      stdout: { columns }
    }
  } as unknown as LocalContext;
}

function buildRow(overrides: Partial<QueryInsightRow> = {}): QueryInsightRow {
  return {
    queryid: '123',
    query:
      'select id, name, email, created_at, updated_at from users where organization_id = $1 order by created_at desc limit $2',
    calls: 10,
    total_exec_time: 250,
    mean_exec_time: 25,
    min_exec_time: 5,
    max_exec_time: 100,
    stddev_exec_time: 10,
    rows: 100,
    shared_blks_hit: 1000,
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
    user: 'postgres',
    cache_hit_rate: 100,
    ...overrides
  };
}

describe('query insights display', () => {
  test('renders longer query previews in the list table', () => {
    const table = stripAnsi(
      renderQueryInsightsTable(buildContext(140), [buildRow()], {
        wide: false
      })
    );

    expect(table).toContain('select id, name, email, created_at, updated_at from users');
    expect(table).toContain('organization_id');
  });

  test('renders query-focused previews for the TUI list table', () => {
    const table = stripAnsi(
      renderQueryInsightsTable(buildContext(120), [buildRow()], {
        wide: false,
        includeSelector: true,
        queryFocused: true,
        selectedIndex: 0
      })
    );

    expect(table).toContain('DB/User');
    expect(table).toContain('organization_id');
  });

  test('renders show-style details with the full query', () => {
    const row = buildRow();
    const details = stripAnsi(renderQueryInsightDetails(row));

    expect(details).toContain('Query ID');
    expect(details).toContain('Cache Hit');
    expect(details).toContain(row.query);
  });

  test('classifies notable query signals conservatively', () => {
    const signals = getQueryInsightSignals(
      buildRow({
        mean_exec_time: 1200,
        max_exec_time: 8000,
        shared_blks_hit: 100,
        shared_blks_read: 100,
        cache_hit_rate: 50,
        temp_blks_written: 10_000,
        rows: 200_000,
        calls: 10
      })
    );

    expect(signals.map((signal) => signal.label)).toEqual([
      'slow mean',
      'latency spikes',
      'low cache hit',
      'temp I/O',
      'many rows'
    ]);
    expect(signals.some((signal) => signal.level === 'critical')).toBe(true);
  });
});
