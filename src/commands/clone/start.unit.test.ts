import { buildApplication, buildRouteMap, run } from '@stricli/core';
import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { CloneConfigCommand } from './config';
import { CloneStartCommand, getSourceUrl } from './start';

afterEach(() => mock.restore());

const createContext = (sourceUrl?: string) => {
  const stdout = mock();
  const stderr = mock();
  const exit = mock((code: number) => {
    throw new Error(`Exit ${code}`);
  });
  const context = {
    debug: true,
    env: { XATA_CLI_SOURCE_POSTGRES_URL: sourceUrl },
    process: { stdout: { write: stdout }, stderr: { write: stderr }, exit }
  } as unknown as LocalContext;
  return { context, stdout, stderr, exit };
};

test.each(['start', 'config'])(
  '%s rejects unsupported source schemes without exposing credentials',
  async (command) => {
    const app = buildApplication(
      buildRouteMap({ docs: { brief: '' }, routes: { start: CloneStartCommand, config: CloneConfigCommand } }),
      { name: 'xata' }
    );
    const { context, stdout, stderr, exit } = createContext('postgresql://fallback/database');
    const consoleError = spyOn(console, 'error').mockImplementation(() => {});
    const consoleLog = spyOn(console, 'log').mockImplementation(() => {});
    const sourceUrl = 'postgresql+psycopg2://private-user:private-password@postgres.fqdn.invalid:5432/database';

    await run(
      app,
      [command, '--source-url', sourceUrl, ...(command === 'start' ? ['--tune-target'] : ['--mode', 'auto'])],
      context
    );

    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr.mock.calls.join('')).toContain('Invalid source database URL. Use postgres:// or postgresql://');
    const output = JSON.stringify([
      stdout.mock.calls,
      stderr.mock.calls,
      consoleError.mock.calls,
      consoleLog.mock.calls
    ]);
    expect(output).not.toContain(sourceUrl);
    expect(output).not.toContain('private-user');
    expect(output).not.toContain('private-password');
  }
);

test.each([
  'postgres://user:p%40ss@host/database?sslmode=require',
  'postgresql://user:pass@[::1]:5433/database',
  'postgresql://host1:5432,host2:5433/database?target_session_attrs=read-write',
  'postgresql:///database?host=%2Fvar%2Frun%2Fpostgresql',
  'postgresql://'
])('preserves a PostgreSQL URI unchanged: %s', (sourceUrl) => {
  const { context } = createContext('postgresql://fallback/database');
  expect(getSourceUrl(context, { 'source-url': sourceUrl })).toBe(sourceUrl);
  const { context: envContext } = createContext(sourceUrl);
  expect(getSourceUrl(envContext, { 'source-url': '' })).toBe(sourceUrl);
});

test.each(['postgresql+psycopg2://host/database', 'https://host/database', 'host/database', 'postgresql:/host'])(
  'rejects an unsupported source from either the flag or environment: %s',
  (sourceUrl) => {
    const { context } = createContext('postgresql://fallback/database');
    expect(() => getSourceUrl(context, { 'source-url': sourceUrl })).toThrow('Exit 1');
    const { context: envContext } = createContext(sourceUrl);
    expect(() => getSourceUrl(envContext, { 'source-url': '' })).toThrow('Exit 1');
  }
);

test('keeps the missing-source error', () => {
  const { context, stderr } = createContext();
  expect(() => getSourceUrl(context, { 'source-url': '' })).toThrow('Exit 1');
  expect(stderr.mock.calls.join('')).toContain('No source database given.');
});
