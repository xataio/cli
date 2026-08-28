import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { NetworkError, SessionExpiredError } from '@xata.io/api';
import type { AuthProfile } from './schemas';

const refreshToken = mock(async () => 'access-token');

const api = await import('./api');

mock.module('~/lib/api', () => ({
  ...api,
  getProfileApi: () => {
    return { refreshToken };
  }
}));

const { getSessionExpiry, isSessionValid } = await import('./session');

const oidcProfile: AuthProfile = {
  type: 'oidc',
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: new Date(0)
};

function buildJwt(payload: Record<string, unknown>) {
  const encode = (value: object) => {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  };

  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function buildOidcProfile(refreshToken: string): AuthProfile {
  return { type: 'oidc', accessToken: 'access', refreshToken, expiresAt: new Date(0) };
}

describe('isSessionValid', () => {
  beforeEach(() => {
    refreshToken.mockClear();
    refreshToken.mockImplementation(async () => 'access-token');
  });

  test('returns true when the token can be refreshed', async () => {
    expect(await isSessionValid('default', oidcProfile)).toBe(true);
    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  test('returns false when the refresh grant is rejected', async () => {
    refreshToken.mockImplementation(async () => {
      throw new SessionExpiredError();
    });

    expect(await isSessionValid('default', oidcProfile)).toBe(false);
  });

  test('returns true when the refresh fails for another reason', async () => {
    refreshToken.mockImplementation(async () => {
      throw new NetworkError('offline');
    });

    expect(await isSessionValid('default', oidcProfile)).toBe(true);
  });

  test('does not refresh api key profiles', async () => {
    expect(await isSessionValid('default', { type: 'apiKey', apiKey: 'xau_test' })).toBe(true);
    expect(refreshToken).not.toHaveBeenCalled();
  });

  test('returns true for profiles that do not exist', async () => {
    expect(await isSessionValid('missing', undefined)).toBe(true);
    expect(refreshToken).not.toHaveBeenCalled();
  });
});

describe('getSessionExpiry', () => {
  test('reads the expiry from the refresh token', () => {
    const exp = Math.floor(Date.now() / 1000) + 86400;

    expect(getSessionExpiry(buildOidcProfile(buildJwt({ exp })))).toEqual(new Date(exp * 1000));
    expect(refreshToken).not.toHaveBeenCalled();
  });

  test('returns undefined for offline tokens that never expire', () => {
    expect(getSessionExpiry(buildOidcProfile(buildJwt({ typ: 'Offline' })))).toBeUndefined();
  });

  test('returns undefined when the expiry is not a positive number', () => {
    expect(getSessionExpiry(buildOidcProfile(buildJwt({ exp: 0 })))).toBeUndefined();
    expect(getSessionExpiry(buildOidcProfile(buildJwt({ exp: 'soon' })))).toBeUndefined();
  });

  test('returns undefined for refresh tokens that are not JWTs', () => {
    expect(getSessionExpiry(buildOidcProfile('opaque-refresh-token'))).toBeUndefined();
  });

  test('returns undefined for api key profiles and missing profiles', () => {
    expect(getSessionExpiry({ type: 'apiKey', apiKey: 'xau_test' })).toBeUndefined();
    expect(getSessionExpiry(undefined)).toBeUndefined();
  });
});
