import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import type { Config } from '~/lib/schemas';

const configState: Config = { activeProfile: 'default', profiles: {} };

mock.module('~/lib/config', () => ({
  config: configState,
  updateConfig: mock(async () => {})
}));

const { implementation } = await import('./status');

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function buildJwt(payload: Record<string, unknown>) {
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const accessToken = buildJwt({ name: 'Alexis Rico', email: 'alexis@xata.io' });

function buildContext() {
  const logs: string[] = [];
  const stderr: string[] = [];
  const exit = mock((_code: number) => {});

  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    return logs.push(args.join(' '));
  };

  const restore = () => {
    console.log = originalLog;
  };

  const context = {
    process: { stderr: { write: (value: string) => stderr.push(value) }, exit }
  } as unknown as LocalContext;

  return { context, logs, stderr, exit, restore };
}

describe('auth status', () => {
  beforeEach(() => {
    configState.activeProfile = 'default';
    configState.profiles = {};
  });

  test('reports that the profile is not logged in', () => {
    const { context, logs, exit, restore } = buildContext();

    try {
      implementation.call(context, {});
    } finally {
      restore();
    }

    expect(logs.join('')).toContain('You are not logged in with profile "default"');
    expect(exit).not.toHaveBeenCalled();
  });

  test('reports the identity and the session expiry from local state', () => {
    const exp = Math.floor(Date.now() / 1000) + 86400;
    configState.profiles = {
      default: {
        type: 'oidc',
        accessToken,
        refreshToken: buildJwt({ exp }),
        expiresAt: new Date(0)
      }
    };
    const { context, logs, exit, restore } = buildContext();

    try {
      implementation.call(context, {});
    } finally {
      restore();
    }

    expect(logs.join('\n')).toContain('Logged in to production with profile "default" as Alexis Rico <alexis@xata.io>');
    expect(logs.join('\n')).toContain(`Session expires on ${new Date(exp * 1000).toISOString()}.`);
    expect(exit).not.toHaveBeenCalled();
  });

  test('fails when the stored session has already expired', () => {
    const exp = Math.floor(Date.now() / 1000) - 60;
    configState.profiles = {
      default: {
        type: 'oidc',
        accessToken,
        refreshToken: buildJwt({ exp }),
        expiresAt: new Date(0)
      }
    };
    const { context, logs, stderr, exit, restore } = buildContext();

    try {
      implementation.call(context, {});
    } finally {
      restore();
    }

    expect(stderr.join('')).toContain(`expired on ${new Date(exp * 1000).toISOString()}`);
    expect(stderr.join('')).toContain('xata auth login');
    expect(logs.join('')).not.toContain('Logged in');
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('does not claim an expiry when the refresh token has none', () => {
    configState.profiles = {
      default: {
        type: 'oidc',
        accessToken,
        refreshToken: buildJwt({ typ: 'Offline' }),
        expiresAt: new Date(0)
      }
    };
    const { context, logs, exit, restore } = buildContext();

    try {
      implementation.call(context, {});
    } finally {
      restore();
    }

    expect(logs.join('\n')).toContain('Logged in to production with profile "default"');
    expect(logs.join('\n')).not.toContain('Session expires on');
    expect(exit).not.toHaveBeenCalled();
  });

  test('reports api key profiles without an expiry', () => {
    configState.profiles = {
      default: { type: 'apiKey', apiKey: 'xau_test', customConfig: { apiBaseUrl: 'https://api.staging.xata.tech' } }
    };
    const { context, logs, exit, restore } = buildContext();

    try {
      implementation.call(context, {});
    } finally {
      restore();
    }

    expect(logs.join('\n')).toContain('Logged in to https://api.staging.xata.tech with profile "default" as unknown');
    expect(logs.join('\n')).not.toContain('Session expires on');
    expect(exit).not.toHaveBeenCalled();
  });
});
