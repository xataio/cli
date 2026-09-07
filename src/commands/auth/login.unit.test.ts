import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import type { Config } from '~/lib/schemas';

// Module-level state shared with the mocked `~/lib/config` module. The object
// identity is kept stable (we only mutate it) so the live binding in login.ts
// always observes the latest state.
const configState: Config = { activeProfile: 'default', profiles: {} };
const updateConfig = mock(async (newConfig: Config) => {
  configState.activeProfile = newConfig.activeProfile;
  configState.profiles = newConfig.profiles;
});

mock.module('~/lib/config', () => ({
  config: configState,
  updateConfig
}));

const getOrganizationsList = mock(async () => ({ organizations: [] }));

// Steps yielded by the fake device flow; empty by default so the device flow
// completes without persisting anything.
let deviceLoginSteps: Array<Record<string, unknown>> = [];
const deviceLogin = mock(async function* () {
  yield* deviceLoginSteps;
});

class FakeXataApi {
  api = { organizations: { getOrganizationsList } };
  static deviceLogin = deviceLogin;
}

mock.module('@xata.io/api', () => ({
  XataApi: FakeXataApi
}));

const isSessionValid = mock(async () => true);
const revokeSession = mock(async () => {});

mock.module('~/lib/session', () => ({ isSessionValid, revokeSession }));

const { implementation } = await import('./login');

function buildContext() {
  const logs: string[] = [];
  const errors: string[] = [];
  const stderr: string[] = [];
  const exit = mock((_code: number) => {});

  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => logs.push(args.join(' '));
  console.error = (...args: unknown[]) => errors.push(args.join(' '));

  const restore = () => {
    console.log = originalLog;
    console.error = originalError;
  };

  const context = {
    process: { exit, stderr: { write: (chunk: string) => stderr.push(chunk) } }
  } as unknown as LocalContext;

  return { context, logs, errors, stderr, exit, restore };
}

function resetMocks() {
  configState.activeProfile = 'default';
  configState.profiles = {};
  deviceLoginSteps = [];
  updateConfig.mockClear();
  deviceLogin.mockClear();
  getOrganizationsList.mockClear();
  getOrganizationsList.mockImplementation(async () => ({ organizations: [] }));
  isSessionValid.mockClear();
  isSessionValid.mockImplementation(async () => true);
  revokeSession.mockClear();
  revokeSession.mockImplementation(async () => {});
}

describe('auth login --api-key', () => {
  beforeEach(resetMocks);

  test('stores an apiKey profile after validating the key', async () => {
    const { context, logs, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: false, 'api-key': 'xau_test' });
    } finally {
      restore();
    }

    expect(getOrganizationsList).toHaveBeenCalledTimes(1);
    expect(updateConfig).toHaveBeenCalledTimes(1);
    expect(configState.activeProfile).toBe('default');
    expect(configState.profiles.default).toEqual({
      type: 'apiKey',
      apiKey: 'xau_test',
      customConfig: { apiBaseUrl: 'https://api.xata.tech' }
    });
    expect(logs.join('')).toContain('Logged in with profile "default" using an API key.');
  });

  test('respects the --profile flag', async () => {
    const { context, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'work', force: false, 'api-key': 'xau_work' });
    } finally {
      restore();
    }

    expect(configState.activeProfile).toBe('work');
    expect(configState.profiles.work).toMatchObject({ type: 'apiKey', apiKey: 'xau_work' });
  });

  test('uses a custom api base url when provided', async () => {
    const { context, restore } = buildContext();

    try {
      await implementation.call(context, {
        profile: 'default',
        force: false,
        'api-key': 'xau_custom',
        'api-url': 'https://api.staging.xata.tech'
      });
    } finally {
      restore();
    }

    expect(configState.profiles.default).toMatchObject({
      customConfig: { apiBaseUrl: 'https://api.staging.xata.tech' }
    });
  });

  test('does not store the profile when the key is invalid', async () => {
    getOrganizationsList.mockImplementationOnce(async () => {
      throw new Error('401 Unauthorized');
    });
    const { context, errors, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: false, 'api-key': 'bad-key' });
    } finally {
      restore();
    }

    expect(updateConfig).not.toHaveBeenCalled();
    expect(configState.profiles.default).toBeUndefined();
    expect(errors.join('')).toContain('The provided API key is invalid');
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('keeps the existing profile when logging in again fails', async () => {
    const existing = { type: 'oidc', accessToken: 'access', refreshToken: 'refresh', expiresAt: new Date(0) } as const;
    configState.profiles = { default: existing };
    isSessionValid.mockImplementation(async () => false);
    getOrganizationsList.mockImplementationOnce(async () => {
      throw new Error('401 Unauthorized');
    });
    const { context, errors, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: false, 'api-key': 'bad-key' });
    } finally {
      restore();
    }

    expect(updateConfig).not.toHaveBeenCalled();
    expect(configState.profiles.default).toEqual(existing);
    expect(errors.join('')).toContain('No changes were made');
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('keeps the existing profile when a forced login fails', async () => {
    const existing = { type: 'apiKey', apiKey: 'existing' } as const;
    configState.profiles = { default: existing };
    getOrganizationsList.mockImplementationOnce(async () => {
      throw new Error('401 Unauthorized');
    });
    const { context, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: true, 'api-key': 'bad-key' });
    } finally {
      restore();
    }

    expect(isSessionValid).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
    expect(configState.profiles.default).toEqual(existing);
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('does not overwrite an existing profile without --force', async () => {
    configState.profiles = { default: { type: 'apiKey', apiKey: 'existing' } };
    const { context, logs, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: false, 'api-key': 'xau_new' });
    } finally {
      restore();
    }

    expect(getOrganizationsList).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
    expect(logs.join('')).toContain('already logged in');
  });

  test('logs in again when the session of an existing profile has expired', async () => {
    configState.profiles = {
      default: { type: 'oidc', accessToken: 'expired', refreshToken: 'expired', expiresAt: new Date(0) }
    };
    isSessionValid.mockImplementation(async () => false);
    const { context, logs, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: false, 'api-key': 'xau_new' });
    } finally {
      restore();
    }

    expect(logs.join('')).toContain('has expired, logging in again');
    expect(configState.profiles.default).toMatchObject({ type: 'apiKey', apiKey: 'xau_new' });
  });

  test('stays on the deployment the profile was created for', async () => {
    configState.profiles = {
      default: {
        type: 'oidc',
        accessToken: 'expired',
        refreshToken: 'expired',
        expiresAt: new Date(0),
        customConfig: { apiBaseUrl: 'https://api.staging.xata.tech' }
      }
    };
    isSessionValid.mockImplementation(async () => false);
    const { context, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: false, 'api-key': 'xau_new' });
    } finally {
      restore();
    }

    expect(configState.profiles.default).toMatchObject({
      customConfig: { apiBaseUrl: 'https://api.staging.xata.tech' }
    });
  });

  test('lets an explicit --api-url move the profile to another deployment', async () => {
    configState.profiles = {
      default: { type: 'apiKey', apiKey: 'existing', customConfig: { apiBaseUrl: 'https://api.staging.xata.tech' } }
    };
    const { context, restore } = buildContext();

    try {
      await implementation.call(context, {
        profile: 'default',
        force: true,
        'api-key': 'xau_new',
        'api-url': 'https://api.xata.tech'
      });
    } finally {
      restore();
    }

    expect(configState.profiles.default).toMatchObject({
      customConfig: { apiBaseUrl: 'https://api.xata.tech' }
    });
  });

  test('falls through to the device flow when no --api-key is passed', async () => {
    const { context, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: false });
    } finally {
      restore();
    }

    expect(getOrganizationsList).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
  });
});

describe('auth login --force revokes the previous session', () => {
  const existing = {
    type: 'oidc',
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    expiresAt: new Date(0),
    customConfig: { apiBaseUrl: 'https://api.staging.xata.tech' }
  } as const;
  const newToken = { type: 'token', accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: new Date(1) };

  beforeEach(() => {
    resetMocks();
    configState.profiles = { default: existing };
    deviceLoginSteps = [newToken];
  });

  test('revokes the old session before starting the device flow and stores the new token', async () => {
    const order: string[] = [];
    revokeSession.mockImplementation(async () => {
      order.push('revoke');
    });
    deviceLogin.mockImplementation(async function* () {
      order.push('device');
      yield* deviceLoginSteps;
    });
    const { context, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: true });
    } finally {
      restore();
    }

    expect(revokeSession).toHaveBeenCalledWith('default');
    expect(order).toEqual(['revoke', 'device']);
    expect(exit).not.toHaveBeenCalled();
    expect(configState.profiles.default).toMatchObject({
      type: 'oidc',
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      customConfig: { apiBaseUrl: 'https://api.staging.xata.tech' }
    });
  });

  test('aborts before the device flow when revocation fails and keeps the old profile', async () => {
    revokeSession.mockImplementation(async () => {
      throw new Error('fetch failed');
    });
    const { context, stderr, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: true });
    } finally {
      restore();
    }

    expect(deviceLogin).not.toHaveBeenCalled();
    expect(updateConfig).not.toHaveBeenCalled();
    expect(configState.profiles.default).toEqual(existing);
    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr.join('')).toContain('Could not revoke the previous session of profile "default": fetch failed');
    expect(stderr.join('')).toContain('auth logout --local --profile default');
  });

  test('reports that the previous session is gone when the new credentials cannot be stored', async () => {
    updateConfig.mockImplementationOnce(async () => {
      throw new Error('Failed to update config file: EACCES');
    });
    const { context, errors, stderr, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: true });
    } finally {
      restore();
    }

    expect(revokeSession).toHaveBeenCalledTimes(1);
    expect(deviceLogin).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(errors).toEqual([]);
    expect(stderr.join('')).toContain(
      'Logged in, but could not store the new credentials of profile "default": Failed to update config file: EACCES'
    );
    expect(stderr.join('')).toContain('The previous session has already been revoked');
    expect(stderr.join('')).toContain('auth login --force --profile default');
  });

  test('revokes the old session after validating a replacement API key', async () => {
    const order: string[] = [];
    getOrganizationsList.mockImplementation(async () => {
      order.push('validate');
      return { organizations: [] };
    });
    revokeSession.mockImplementation(async () => {
      order.push('revoke');
    });
    const { context, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: true, 'api-key': 'xau_new' });
    } finally {
      restore();
    }

    expect(order).toEqual(['validate', 'revoke']);
    expect(configState.profiles.default).toMatchObject({ type: 'apiKey', apiKey: 'xau_new' });
  });

  test('does not revoke the old session when the replacement API key is invalid', async () => {
    getOrganizationsList.mockImplementationOnce(async () => {
      throw new Error('401 Unauthorized');
    });
    const { context, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: true, 'api-key': 'bad-key' });
    } finally {
      restore();
    }

    expect(revokeSession).not.toHaveBeenCalled();
    expect(configState.profiles.default).toEqual(existing);
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('keeps the old profile when revocation fails during an API key login', async () => {
    revokeSession.mockImplementation(async () => {
      throw new Error('fetch failed');
    });
    const { context, exit, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: true, 'api-key': 'xau_new' });
    } finally {
      restore();
    }

    expect(updateConfig).not.toHaveBeenCalled();
    expect(configState.profiles.default).toEqual(existing);
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('does not revoke when replacing an API key profile', async () => {
    configState.profiles = { default: { type: 'apiKey', apiKey: 'existing' } };
    const { context, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: true });
    } finally {
      restore();
    }

    expect(revokeSession).not.toHaveBeenCalled();
    expect(configState.profiles.default).toMatchObject({ type: 'oidc', accessToken: 'new-access' });
  });

  test('does not revoke a session the provider has already rejected', async () => {
    isSessionValid.mockImplementation(async () => false);
    const { context, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: false });
    } finally {
      restore();
    }

    expect(revokeSession).not.toHaveBeenCalled();
    expect(configState.profiles.default).toMatchObject({ type: 'oidc', accessToken: 'new-access' });
  });

  test('does not revoke when there is no existing profile', async () => {
    configState.profiles = {};
    const { context, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: true });
    } finally {
      restore();
    }

    expect(revokeSession).not.toHaveBeenCalled();
    expect(configState.profiles.default).toMatchObject({ type: 'oidc', accessToken: 'new-access' });
  });
});
