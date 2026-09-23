import { describe, expect, mock, test } from 'bun:test';
import { createElement } from 'react';
import { renderInk, settle, waitFor } from '~/console/ink-test-harness';
import { formatResults, SQLView, type SQLResult, type SQLViewProps } from './sql-view';

const props = (overrides: Partial<SQLViewProps> = {}): SQLViewProps => ({
  target: 'acme / shop / main · app',
  schemaCount: 2,
  tableCount: 12,
  columns: 100,
  rows: 30,
  isActive: true,
  onGenerateSQL: async () => 'SELECT 42;',
  onExecuteSQL: async () => [],
  ...overrides
});

describe('AI SQL workspace', () => {
  test('pasted Unicode prompt, single in-flight generation, explicit single execution, and refinement', async () => {
    const generation = Promise.withResolvers<string>();
    const execution = Promise.withResolvers<SQLResult[]>();
    const onGenerateSQL = mock(() => generation.promise);
    const onExecuteSQL = mock(() => execution.promise);
    const app = renderInk(createElement(SQLView, props({ onGenerateSQL, onExecuteSQL })));
    try {
      await settle();
      app.press('Find café orders?');
      await settle();
      app.press('\r');
      app.press('\r');
      await waitFor(() => expect(onGenerateSQL).toHaveBeenCalledTimes(1));
      expect(onGenerateSQL).toHaveBeenCalledWith('Find café orders?', '');
      generation.resolve('SELECT 42;');
      await waitFor(() => expect(app.lastFrame()).toContain('Execute this SQL?'));
      app.press('\r');
      await settle();
      expect(onExecuteSQL).not.toHaveBeenCalled();
      app.press('y');
      app.press('y');
      await waitFor(() => expect(onExecuteSQL).toHaveBeenCalledTimes(1));
      expect(onExecuteSQL).toHaveBeenCalledWith('SELECT 42;');
      execution.resolve([{ command: 'UPDATE', count: 7, columns: [], rows: [] }]);
      await waitFor(() => expect(app.lastFrame()).toContain('UPDATE · 7 rows affected'));
      app.press('only yesterday');
      await settle();
      app.press('\r');
      await waitFor(() => expect(onGenerateSQL).toHaveBeenCalledTimes(2));
      expect(onGenerateSQL).toHaveBeenLastCalledWith('only yesterday', 'SELECT 42;');
    } finally {
      app.unmount();
    }
  });

  test('declining preserves SQL; generation and execution failures remain recoverable', async () => {
    const onGenerateSQL = mock<SQLViewProps['onGenerateSQL']>()
      .mockResolvedValueOnce('SELECT 13;')
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce('SELECT 17;');
    const onExecuteSQL = mock(async () => {
      throw new Error('permission denied');
    });
    const app = renderInk(createElement(SQLView, props({ onGenerateSQL, onExecuteSQL })));
    try {
      await settle();
      app.press('first');
      await settle();
      app.press('\r');
      await waitFor(() => expect(app.lastFrame()).toContain('Execute this SQL?'));
      await settle();
      app.press('n');
      await settle();
      await waitFor(() => expect(app.lastFrame()).toContain('enter generate'));
      expect(onExecuteSQL).not.toHaveBeenCalled();
      app.press('second');
      await settle();
      app.press('\r');
      await waitFor(() => expect(app.lastFrame()).toContain('provider unavailable'));
      expect(app.lastFrame()).toContain('SELECT 13;');
      expect(onGenerateSQL).toHaveBeenLastCalledWith('second', 'SELECT 13;');
      app.press('\r');
      await waitFor(() => expect(app.lastFrame()).toContain('SELECT 17;'));
      await settle();
      app.press('y');
      await waitFor(() => expect(app.lastFrame()).toContain('permission denied'));
      expect(app.lastFrame()).toContain('SELECT 17;');
      expect(app.lastFrame()).toContain('ctrl+r retry');
    } finally {
      app.unmount();
    }
  });

  test('inactive input and blank prompts do not generate', async () => {
    const onGenerateSQL = mock(async () => '');
    for (const isActive of [false, true]) {
      const app = renderInk(createElement(SQLView, props({ isActive, onGenerateSQL })));
      try {
        await settle();
        app.press(isActive ? '   ' : 'query');
        await settle();
        app.press('\r');
        await settle();
        expect(onGenerateSQL).not.toHaveBeenCalled();
      } finally {
        app.unmount();
      }
    }
  });

  test('failed SQL can be retried or manually edited, but both require fresh approval', async () => {
    const onGenerateSQL = mock(async () => 'SELECT missing;');
    const onExecuteSQL = mock<SQLViewProps['onExecuteSQL']>()
      .mockRejectedValueOnce(new Error('column missing does not exist'))
      .mockRejectedValueOnce(new Error('column missing does not exist'))
      .mockResolvedValueOnce([{ command: 'SELECT', count: 1, columns: ['answer'], rows: [{ answer: 37 }] }]);
    const app = renderInk(createElement(SQLView, props({ onGenerateSQL, onExecuteSQL })));
    try {
      await settle();
      app.press('query');
      await settle();
      app.press('\r');
      await waitFor(() => expect(app.lastFrame()).toContain('Execute this SQL?'));
      await settle();
      app.press('y');
      await waitFor(() => expect(app.lastFrame()).toContain('ctrl+r retry'));
      await settle();
      app.press('\u0012');
      await waitFor(() => expect(app.lastFrame()).toContain('Execute this SQL?'));
      await settle();
      expect(onExecuteSQL).toHaveBeenCalledTimes(1);
      app.press('y');
      await waitFor(() => expect(onExecuteSQL).toHaveBeenCalledTimes(2));
      expect(onExecuteSQL).toHaveBeenLastCalledWith('SELECT missing;');
      await waitFor(() => expect(app.lastFrame()).toContain('ctrl+r retry'));
      await settle();
      app.press('\u0005');
      await waitFor(() => expect(app.lastFrame()).toContain('Edit SQL'));
      await settle();
      app.press('\u0015');
      await settle();
      app.press('SELECT\n37 AS answer;');
      await settle();
      app.press('\u0013');
      await waitFor(() => expect(app.lastFrame()).toContain('Execute this SQL?'));
      await settle();
      expect(onExecuteSQL).toHaveBeenCalledTimes(2);
      expect(onGenerateSQL).toHaveBeenCalledTimes(1);
      app.press('y');
      await waitFor(() => expect(app.lastFrame()).toContain('1 rows returned'));
      expect(app.lastFrame()).toContain('37');
      expect(onExecuteSQL).toHaveBeenLastCalledWith('SELECT\n37 AS answer;');
      app.press('refine');
      await settle();
      app.press('\r');
      await waitFor(() => expect(onGenerateSQL).toHaveBeenCalledTimes(2));
      expect(onGenerateSQL).toHaveBeenLastCalledWith('refine', 'SELECT\n37 AS answer;');
    } finally {
      app.unmount();
    }
  });

  test('long SQL can be reviewed to its last line before approving', async () => {
    const sql = Array.from({ length: 40 }, (_, index) => `SELECT ${index};`).join('\n');
    const app = renderInk(createElement(SQLView, props({ rows: 24, columns: 80, onGenerateSQL: async () => sql })));
    try {
      await settle();
      app.press('query');
      await settle();
      app.press('\r');
      await waitFor(() => expect(app.lastFrame()).toContain('Execute this SQL?'));
      expect(app.lastFrame()).not.toContain('SELECT 39;');
      for (let i = 0; i < 6; i++) {
        app.press('\u001b[6~');
        await settle();
      }
      expect(app.lastFrame()).toContain('SELECT 39;');
      expect(app.lastFrame()).toContain('to confirm');
      expect(app.lastFrame().split('\n').length).toBeLessThanOrEqual(24);
    } finally {
      app.unmount();
    }
  });

  test('late rejected generation after unmount is handled', async () => {
    const deferred = Promise.withResolvers<string>();
    const generate = mock(() => deferred.promise);
    const app = renderInk(createElement(SQLView, props({ onGenerateSQL: generate })));
    await settle();
    app.press('query');
    await settle();
    app.press('\r');
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    app.unmount();
    deferred.reject(new Error('late failure'));
    await settle();
  });

  test('blank generated SQL cannot be approved and retains the prompt for retry', async () => {
    const execute = mock(async () => []);
    const app = renderInk(createElement(SQLView, props({ onGenerateSQL: async () => '  ', onExecuteSQL: execute })));
    try {
      await settle();
      app.press('question');
      await settle();
      app.press('\r');
      await waitFor(() => expect(app.lastFrame()).toContain('No SQL generated'));
      expect(app.lastFrame()).toContain('question');
      expect(app.lastFrame()).not.toContain('Execute this SQL?');
      expect(execute).not.toHaveBeenCalled();
    } finally {
      app.unmount();
    }
  });

  test('wide Unicode SQL remains one viewport line and can be panned to the end', async () => {
    const sql = `SELECT '${'表'.repeat(90)}END';`;
    const app = renderInk(createElement(SQLView, props({ columns: 80, rows: 24, onGenerateSQL: async () => sql })));
    try {
      await settle();
      app.press('query');
      await settle();
      app.press('\r');
      await waitFor(() => expect(app.lastFrame()).toContain('Execute this SQL?'));
      expect(app.lastFrame()).not.toContain('END');
      for (let i = 0; i < 8; i++) {
        app.press('\u001b[C');
        await settle();
      }
      expect(app.lastFrame()).toContain("END';");
      expect(app.lastFrame()).toContain('lines 1–1 of 1');
      expect(app.lastFrame().split('\n').length).toBeLessThan(24);
    } finally {
      app.unmount();
    }
  });

  test('too-small terminals disable input instead of hiding execution controls', async () => {
    const generate = mock(async () => 'SELECT 1;');
    const app = renderInk(createElement(SQLView, props({ columns: 40, rows: 10, onGenerateSQL: generate })));
    try {
      await settle();
      app.press('query');
      await settle();
      app.press('\r');
      await settle();
      expect(app.lastFrame()).toContain('Resize terminal');
      expect(generate).not.toHaveBeenCalled();
    } finally {
      app.unmount();
    }
  });
});

test('result preview preserves structured and null values and reports truncation', () => {
  const text = formatResults([
    {
      command: 'SELECT',
      count: 101,
      columns: ['id', 'value'],
      rows: Array.from({ length: 101 }, (_, id) => ({ id, value: id === 0 ? null : { enabled: false } }))
    }
  ]);
  expect(text).toContain('Showing 100 of 101 rows');
  expect(text).toContain('NULL');
  expect(text).toContain('{"enabled":false}');
  expect(text).not.toMatch(/^100\s/m);
});
