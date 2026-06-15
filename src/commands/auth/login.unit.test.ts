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

const { implementation } = await import('./login');

function buildContext() {
  const logs: string[] = [];
  const errors: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => logs.push(args.join(' '));
  console.error = (...args: unknown[]) => errors.push(args.join(' '));

  const restore = () => {
    console.log = originalLog;
    console.error = originalError;
  };

  const context = {} as unknown as LocalContext;

  return { context, logs, errors, restore };
}

describe('auth login --api-key', () => {
  beforeEach(() => {
    configState.activeProfile = 'default';
    configState.profiles = {};
    updateConfig.mockClear();
    getOrganizationsList.mockClear();
    getOrganizationsList.mockImplementation(async () => ({ organizations: [] }));
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
    const { context, errors, restore } = buildContext();

    try {
      await implementation.call(context, { profile: 'default', force: false, 'api-key': 'bad-key' });
    } finally {
      restore();
    }

    expect(updateConfig).not.toHaveBeenCalled();
    expect(configState.profiles.default).toBeUndefined();
    expect(errors.join('')).toContain('The provided API key is invalid');
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
