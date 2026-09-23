import { expect, mock, test } from 'bun:test';
import { createElement } from 'react';
import { renderInk, settle, waitFor } from '~/console/ink-test-harness';
import { SQLEditor } from './sql-editor';

test('edits across lines with navigation, backspace, forward delete, newline, and Unicode paste', async () => {
  const onSave = mock();
  const app = renderInk(
    createElement(SQLEditor, {
      sql: 'SELECT 12;\nSELECT 99;',
      columns: 78,
      rows: 17,
      isActive: true,
      onSave,
      onCancel: mock()
    })
  );
  try {
    await settle();
    for (const key of [
      '\u001b[F',
      '\u001b[D',
      '\u007f',
      '7',
      '\u001b[B',
      '\u001b[D',
      '\u001b[3~',
      '\u001b[F',
      '\r',
      "SELECT 'café';"
    ]) {
      app.press(key);
      await settle();
    }
    app.press('\u0013');
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("SELECT 17;\nSELECT 9;\nSELECT 'café';"));
    expect(app.lastFrame()).toContain('Line 3, column 15');
  } finally {
    app.unmount();
  }
});

test('empty SQL cannot be saved and escape discards draft changes', async () => {
  const onSave = mock();
  const onCancel = mock();
  const app = renderInk(
    createElement(SQLEditor, {
      sql: 'SELECT 1;',
      columns: 78,
      rows: 17,
      isActive: true,
      onSave,
      onCancel
    })
  );
  try {
    await settle();
    app.press('\u0015');
    await settle();
    app.press('\u0013');
    await waitFor(() => expect(app.lastFrame()).toContain('SQL cannot be empty'));
    expect(onSave).not.toHaveBeenCalled();
    app.press('\u001b');
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  } finally {
    app.unmount();
  }
});

test('inactive editor does not consume shortcuts', async () => {
  const onSave = mock();
  const onCancel = mock();
  const app = renderInk(
    createElement(SQLEditor, {
      sql: 'SELECT 1;',
      columns: 78,
      rows: 17,
      isActive: false,
      onSave,
      onCancel
    })
  );
  try {
    await settle();
    app.press('\u0013');
    app.press('\u001b');
    await settle();
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  } finally {
    app.unmount();
  }
});
