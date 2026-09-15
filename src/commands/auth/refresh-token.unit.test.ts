import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import type { Config } from '~/lib/schemas';

const configState: Config = { activeProfile: 'staging', profiles: {} };

mock.module('~/lib/config', () => ({ config: configState }));

const { implementation } = await import('./refresh-token');

const profileWithToken = (refreshToken: string) =>
  ({ type: 'oidc', accessToken: 'a', refreshToken, expiresAt: new Date(0) }) as const;

function buildContext() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const context = {
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      exit: mock(() => {})
    }
  } as unknown as LocalContext;

  return { context, stdout, stderr };
}

describe('auth refresh-token', () => {
  beforeEach(() => {
    configState.activeProfile = 'staging';
    configState.profiles = { default: profileWithToken('default-token'), staging: profileWithToken('staging-token') };
  });

  test("prints the active profile's token rather than the one named default", async () => {
    const { context, stdout, stderr } = buildContext();

    await implementation.call(context, {});

    expect(stderr).toEqual([]);
    expect(stdout.join('')).toBe('staging-token');
  });

  test('prints the token of the profile named with --profile', async () => {
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, profile: 'default' }, {});

    expect(stdout.join('')).toBe('default-token');
  });
});
