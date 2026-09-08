import { describe, expect, mock, test } from 'bun:test';
import { createElement } from 'react';
import type { LocalContext } from '~/context';
import { renderInk, waitFor } from '../ink-test-harness';
import { InsightsView } from './insights-view';

const insightRow = {
  queryid: '42',
  query: 'select * from users',
  calls: 3,
  total_exec_time: 30,
  mean_exec_time: 10,
  min_exec_time: 5,
  max_exec_time: 15,
  stddev_exec_time: 1,
  rows: 3,
  shared_blks_hit: 10,
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
  total_count: 1
};

function buildContext() {
  const listQueries: { sql: string; response: PromiseWithResolvers<unknown[]> }[] = [];
  const unsafe = mock((sql: string) => {
    if (sql.includes('pg_available_extensions')) {
      return Promise.resolve([{ available: true, installed: true, preloaded: true, sharedPreloadLibraries: '' }]);
    }
    if (sql.includes('SELECT 1 FROM pg_stat_statements LIMIT 1')) {
      return Promise.resolve([]);
    }
    const response = Promise.withResolvers<unknown[]>();
    listQueries.push({ sql, response });
    return response.promise;
  });
  const context = {
    postgres: mock(() => ({ unsafe, end: mock(async () => {}) }))
  } as unknown as LocalContext;

  return { context, listQueries };
}

describe('InsightsView polling', () => {
  test('keeps polling after the sort changes while a request is in flight', async () => {
    const { context, listQueries } = buildContext();
    const app = renderInk(
      createElement(InsightsView, {
        context,
        connectionString: 'postgresql://user:pass@localhost/postgres',
        branchName: 'main',
        isActive: true,
        rows: 40,
        columns: 120
      })
    );

    try {
      await waitFor(() => expect(listQueries).toHaveLength(1));
      expect(listQueries[0]!.sql).toMatch(/ORDER BY pg_stat_statements\.total_exec_time/);

      app.press('s');
      await waitFor(() => expect(listQueries).toHaveLength(2));
      expect(listQueries[1]!.sql).toMatch(/ORDER BY pg_stat_statements\.mean_exec_time/);

      listQueries[0]!.response.resolve([insightRow]);
      listQueries[1]!.response.resolve([insightRow]);
      await waitFor(() => expect(app.lastFrame()).toContain('select * from users'));
      expect(app.lastFrame()).toContain('sort: mean-time');
    } finally {
      app.unmount();
    }
  });
});
