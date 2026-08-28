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

class FakeXataApi {
  api = { organizations: { getOrganizationsList } };
  static async *deviceLogin() {
    // Not exercised by the API key flow.
  }
}

mock.module('@xata.io/api', () => ({
  XataApi: FakeXataApi
}));

const isSessionValid = mock(async () => true);

mock.module('~/lib/session', () => ({ isSessionValid }));

const { implementation } = await import('./login');

function buildContext() {
  const logs: string[] = [];
  const errors: string[] = [];
  const exit = mock((_code: number) => {});

  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => logs.push(args.join(' '));
  console.error = (...args: unknown[]) => errors.push(args.join(' '));

  const restore = () => {
    console.log = originalLog;
    console.error = originalError;
  };

  const context = { process: { exit } } as unknown as LocalContext;

  return { context, logs, errors, exit, restore };
}

describe('auth login --api-key', () => {
  beforeEach(() => {
    configState.activeProfile = 'default';
    configState.profiles = {};
    updateConfig.mockClear();
    getOrganizationsList.mockClear();
    getOrganizationsList.mockImplementation(async () => ({ organizations: [] }));
    isSessionValid.mockClear();
    isSessionValid.mockImplementation(async () => true);
  });

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
