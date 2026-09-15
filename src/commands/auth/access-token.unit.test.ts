import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import type { Config } from '~/lib/schemas';

const configState: Config = { activeProfile: 'staging', profiles: {} };

mock.module('~/lib/config', () => ({ config: configState }));

const { implementation } = await import('./access-token');

const oidcProfile = { type: 'oidc', accessToken: 'a', refreshToken: 'r', expiresAt: new Date(0) } as const;

function buildContext() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const context = {
    refreshToken: mock(async () => 'access-token'),
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      exit: mock(() => {})
    }
  } as unknown as LocalContext;

  return { context, stdout, stderr };
}

describe('auth access-token', () => {
  beforeEach(() => {
    configState.activeProfile = 'staging';
    configState.profiles = { staging: oidcProfile };
  });

  test('uses the active profile when --profile is not passed, even with no profile named default', async () => {
    const { context, stdout, stderr } = buildContext();

    await implementation.call(context, {});

    expect(stderr).toEqual([]);
    expect(stdout.join('')).toBe('access-token');
  });

  test('still reports a profile named with --profile that does not exist', async () => {
    const { context, stdout, stderr } = buildContext();

    await implementation.call({ ...context, profile: 'default' }, {});

    expect(stdout).toEqual([]);
    expect(stderr.join('')).toBe('Profile "default" does not exist.\n');
    expect(context.process.exit).toHaveBeenCalledWith(1);
  });
});
