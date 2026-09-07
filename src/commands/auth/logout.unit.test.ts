import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import type { Config } from '~/lib/schemas';

const configState: Config = { activeProfile: 'default', profiles: {} };
const updateConfig = mock(async (newConfig: Config) => {
  configState.activeProfile = newConfig.activeProfile;
  configState.profiles = newConfig.profiles;
});

mock.module('~/lib/config', () => ({
  config: configState,
  updateConfig
}));

const revokeSession = mock(async () => {});
const isSessionValid = mock(async () => true);

mock.module('~/lib/session', () => ({ isSessionValid, revokeSession }));

const { implementation } = await import('./logout');

const oidcProfile = { type: 'oidc', accessToken: 'access', refreshToken: 'refresh', expiresAt: new Date(0) } as const;
const apiKeyProfile = { type: 'apiKey', apiKey: 'xau_test' } as const;

function buildContext({ confirm = true }: { confirm?: boolean } = {}) {
  const logs: string[] = [];
  const stderr: string[] = [];
  const exit = mock((_code: number) => {});
  const confirmPrompt = mock(async (_isInteractive: boolean, _message: string) => confirm);

  const originalLog = console.log;
  console.log = (...args: unknown[]) => logs.push(args.join(' '));
  const restore = () => {
    console.log = originalLog;
  };

  const context = {
    isInteractive: true,
    enquirer: { confirmPrompt },
    getActiveProfile: () => configState.activeProfile,
    process: { exit, stderr: { write: (chunk: string) => stderr.push(chunk) } }
  } as unknown as LocalContext;

  return { context, logs, stderr, exit, confirmPrompt, restore };
}

describe('auth logout', () => {
  beforeEach(() => {
    configState.activeProfile = 'default';
    configState.profiles = { default: oidcProfile };
    updateConfig.mockClear();
    revokeSession.mockClear();
    revokeSession.mockImplementation(async () => {});
  });

  test('revokes the session and removes the profile', async () => {
    const { context, logs, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', yes: true, local: false });
    } finally {
      restore();
    }

    expect(revokeSession).toHaveBeenCalledTimes(1);
    expect(revokeSession).toHaveBeenCalledWith('default');
    expect(updateConfig).toHaveBeenCalledTimes(1);
    expect(configState.profiles.default).toBeUndefined();
    expect(configState.activeProfile).toBe('');
    expect(logs.join('')).toContain('Revoked the session and removed the local credentials of profile "default"');
  });

  test('keeps the profile and fails when the session cannot be revoked', async () => {
    revokeSession.mockImplementation(async () => {
      throw new Error('fetch failed');
    });
    const { context, logs, stderr, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', yes: true, local: false });
    } finally {
      restore();
    }

    expect(updateConfig).not.toHaveBeenCalled();
    expect(configState.profiles.default).toEqual(oidcProfile);
    expect(configState.activeProfile).toBe('default');
    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr.join('')).toContain('Could not revoke the session of profile "default": fetch failed');
    expect(stderr.join('')).toContain('auth logout --local --profile default');
    expect(logs.join('')).not.toContain('Revoked');
  });

  test('--local removes the profile without revoking the session', async () => {
    const { context, logs, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', yes: true, local: true });
    } finally {
      restore();
    }

    expect(revokeSession).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(configState.profiles.default).toBeUndefined();
    expect(logs.join('')).toContain('Removed the local credentials of profile "default"');
    expect(logs.join('')).toContain('The session was not revoked');
  });

  test('API key profiles are only removed locally', async () => {
    configState.profiles = { default: apiKeyProfile };
    const { context, logs, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', yes: true, local: false });
    } finally {
      restore();
    }

    expect(revokeSession).not.toHaveBeenCalled();
    expect(configState.profiles.default).toBeUndefined();
    expect(logs.join('')).toContain('Logged out of profile "default"');
  });

  test('does nothing when the confirmation is declined', async () => {
    const { context, confirmPrompt, stderr, exit, restore } = buildContext({ confirm: false });

    try {
      await implementation.call(context, { profile: 'default', yes: false, local: false });
    } finally {
      restore();
    }

    expect(confirmPrompt).toHaveBeenCalledTimes(1);
    expect(revokeSession).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
    expect(configState.profiles.default).toEqual(oidcProfile);
    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr.join('')).toContain('Aborted as there was no confirmation');
  });

  test('points to --local when the credentials cannot be removed after revoking', async () => {
    updateConfig.mockImplementationOnce(async () => {
      throw new Error('Failed to update config file: EACCES');
    });
    const { context, logs, stderr, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', yes: true, local: false });
    } finally {
      restore();
    }

    expect(revokeSession).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr.join('')).toContain(
      'Revoked the session of profile "default" but could not remove the local credentials: Failed to update config file: EACCES'
    );
    expect(stderr.join('')).toContain('auth logout --local --profile default');
    expect(logs.join('')).not.toContain('Revoked the session and removed');
    // The in-memory config is left alone when the write fails.
    expect(configState.activeProfile).toBe('default');
    expect(configState.profiles.default).toEqual(oidcProfile);
  });

  test('warns that revoking may affect other CLI installations before confirming', async () => {
    const { context, confirmPrompt, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', yes: false, local: false });
    } finally {
      restore();
    }

    expect(confirmPrompt.mock.calls[0]?.[1]).toContain('other CLI installations');
  });

  test('only touches the requested profile', async () => {
    configState.activeProfile = 'default';
    configState.profiles = { default: oidcProfile, work: { ...oidcProfile, refreshToken: 'work-refresh' } };
    const { context, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'work', yes: true, local: false });
    } finally {
      restore();
    }

    expect(revokeSession).toHaveBeenCalledWith('work');
    expect(configState.profiles.work).toBeUndefined();
    expect(configState.profiles.default).toEqual(oidcProfile);
    expect(configState.activeProfile).toBe('default');
  });

  test('reports when a profile does not exist', async () => {
    configState.profiles = {};
    const { context, logs, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'missing', yes: true, local: false });
    } finally {
      restore();
    }

    expect(revokeSession).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
    expect(logs.join('')).toContain('does not exist');
  });
});
