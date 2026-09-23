import { expect, mock, test } from 'bun:test';
import { formatResults } from '~/ai/sql-view';
import type { LocalContext } from '~/context';
import { implementation, normalizeResults } from './sql';

const result = (command: string, count: number | null, rows: Record<string, unknown>[], columns?: string[] | null) =>
  Object.assign(rows, {
    command,
    count,
    columns: columns == null ? columns : columns.map((name) => ({ name }))
  });

test('normalizes single and multiple Postgres result sets, including empty SELECT and UPDATE', () => {
  const select = result('SELECT', 1, [{ total: 23 }], ['total']);
  const update = result('UPDATE', 7, []);
  const empty = result('SELECT', 0, [], ['name']);
  expect(normalizeResults(select)).toEqual([
    { command: 'SELECT', count: 1, columns: ['total'], rows: [{ total: 23 }] }
  ]);
  expect(normalizeResults([update, empty, select])).toEqual([
    { command: 'UPDATE', count: 7, columns: [], rows: [] },
    { command: 'SELECT', count: 0, columns: ['name'], rows: [] },
    { command: 'SELECT', count: 1, columns: ['total'], rows: [{ total: 23 }] }
  ]);
});

test('command-only statements accept absent column metadata and do not invent affected counts', () => {
  for (const columns of [undefined, null]) {
    const create = result('CREATE TABLE', null, [], columns);
    expect(normalizeResults(create)).toEqual([{ command: 'CREATE TABLE', count: null, columns: [], rows: [] }]);
    expect(formatResults(normalizeResults(create))).toBe('CREATE TABLE · completed');
    const insert = result('INSERT', 8, [], columns);
    const select = result(
      'SELECT',
      1,
      [{ average_salary: '80250.00', median_salary: 80000 }],
      ['average_salary', 'median_salary']
    );
    const text = formatResults(normalizeResults([insert, select]));
    expect(text).toContain('INSERT · 8 rows affected');
    expect(text).toContain('SELECT · 1 rows returned');
    expect(text).toContain('average_salary');
    expect(text).toContain('80250.00');
    expect(text).toContain('80000');
  }
});

test('non-interactive and missing-key failures happen before resolving targets or connecting', async () => {
  for (const isInteractive of [false, true]) {
    const write = mock();
    const getOrganization = mock();
    const postgres = mock();
    const context = {
      isInteractive,
      env: {},
      getOrganization,
      postgres,
      process: {
        stdin: { isTTY: true },
        stdout: { isTTY: true },
        stderr: { write },
        exit: () => {
          throw new Error('exit');
        }
      }
    } as unknown as LocalContext;
    await expect(implementation.call(context, { yes: false })).rejects.toThrow('exit');
    expect(write.mock.calls[0]?.[0]).toContain(isInteractive ? 'ANTHROPIC_API_KEY' : 'interactive terminal');
    expect(getOrganization).not.toHaveBeenCalled();
    expect(postgres).not.toHaveBeenCalled();
  }
});
