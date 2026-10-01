import { buildApplication, buildRouteMap, run } from '@stricli/core';
import { expect, mock, test } from 'bun:test';
import { AiRoute } from './index';

const app = buildApplication(buildRouteMap({ docs: { brief: '' }, routes: { ai: AiRoute } }), { name: 'xata' });

const context = () => ({
  process: { stdout: { write: mock() }, stderr: { write: mock() }, exitCode: undefined as number | undefined },
  forCommand: mock(async () => {
    throw new Error('Must not initialize command context');
  })
});

test('AI help retains SQL and no longer advertises downloads', async () => {
  const ctx = context();
  await run(app, ['ai', '--help'], ctx);
  expect(ctx.process.exitCode ?? 0).toBe(0);
  const output = ctx.process.stdout.write.mock.calls.join('');
  expect(output).toContain('sql');
  expect(output).not.toContain('download');
  expect(ctx.forCommand).not.toHaveBeenCalled();
});

test('SQL help still resolves without initializing command context', async () => {
  const ctx = context();
  await run(app, ['ai', 'sql', '--help'], ctx);
  expect(ctx.process.exitCode ?? 0).toBe(0);
  expect(ctx.process.stdout.write.mock.calls.join('')).toContain('--model');
  expect(ctx.forCommand).not.toHaveBeenCalled();
});

test('legacy download is rejected before initializing command context', async () => {
  const ctx = context();
  await run(app, ['ai', 'download', 'claude-skill'], ctx);
  expect(ctx.process.exitCode).toBeNumber();
  expect(ctx.process.exitCode).not.toBe(0);
  expect(ctx.process.stderr.write.mock.calls.join('')).toContain('No command registered for `download`');
  expect(ctx.forCommand).not.toHaveBeenCalled();
});
