import { describe, expect, test } from 'bun:test';
import { resolveConsoleUrl } from './console-url';
import { ConfigSchema } from './schemas';

const custom = { apiBaseUrl: 'https://api.staging.example.com' };
const withConsole = { ...custom, consoleUrl: 'https://app.staging.example.com' };

describe('resolveConsoleUrl', () => {
  test('prefers XATA_CONSOLE_URL over the profile', () => {
    expect(resolveConsoleUrl('http://localhost:3000', withConsole)).toBe('http://localhost:3000');
  });

  test('uses the profile when XATA_CONSOLE_URL is unset or blank', () => {
    for (const env of [undefined, '', '  ']) {
      expect(resolveConsoleUrl(env, withConsole)).toBe('https://app.staging.example.com');
    }
  });

  test('defaults to the production console for the production API', () => {
    expect(resolveConsoleUrl(undefined, undefined)).toBe('https://console.xata.io');
    expect(resolveConsoleUrl('', { apiBaseUrl: 'https://api.xata.tech/' })).toBe('https://console.xata.io');
    expect(resolveConsoleUrl(undefined, { issuer: 'https://auth.xata.io/realms/xata' })).toBe(
      'https://console.xata.io'
    );
  });

  test('requires a console URL for a custom API', () => {
    expect(() => resolveConsoleUrl(undefined, { ...custom, consoleUrl: ' ' })).toThrow('--console-url');
  });

  test('names the source of an insecure URL', () => {
    expect(() => resolveConsoleUrl('http://example.com', withConsole)).toThrow(
      'XATA_CONSOLE_URL must use HTTPS (or HTTP on localhost).'
    );
    expect(() => resolveConsoleUrl(undefined, { ...custom, consoleUrl: 'http://example.com' })).toThrow(
      'The console URL must use HTTPS (or HTTP on localhost).'
    );
  });

  test('keeps only the origin', () => {
    expect(resolveConsoleUrl('https://app.staging.example.com/some/path/', undefined)).toBe(
      'https://app.staging.example.com'
    );
  });
});

// Profiles exactly as xata-cli v1.14.2 writes them.
const releasedProfiles = {
  oidc: {
    type: 'oidc',
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: '2026-09-30T12:00:00.000Z',
    customConfig: {
      issuer: 'https://auth.xata.io/realms/xata',
      clientId: 'cli',
      clientSecret: 'secret',
      apiBaseUrl: 'https://api.xata.tech'
    }
  },
  apiKey: { type: 'apiKey', apiKey: 'xau_key', customConfig: { apiBaseUrl: 'https://api.xata.tech' } },
  legacy: { type: 'apiKey', apiKey: 'xau_key' },
  staging: { type: 'apiKey', apiKey: 'xau_key', customConfig: { apiBaseUrl: 'https://api.staging.example.com' } }
};

describe('profiles written by the released CLI', () => {
  const { profiles } = ConfigSchema.parse({ activeProfile: 'oidc', profiles: releasedProfiles });

  test('parse unchanged', () => {
    expect(profiles).toEqual({
      ...releasedProfiles,
      oidc: { ...releasedProfiles.oidc, expiresAt: new Date(releasedProfiles.oidc.expiresAt) }
    } as unknown as typeof profiles);
  });

  test('use the production console on the production API', () => {
    for (const name of ['oidc', 'apiKey', 'legacy']) {
      expect(resolveConsoleUrl(undefined, profiles[name]?.customConfig)).toBe('https://console.xata.io');
    }
  });

  test('ask a custom deployment for its console URL', () => {
    expect(() => resolveConsoleUrl(undefined, profiles.staging?.customConfig)).toThrow('--console-url');
    expect(resolveConsoleUrl('https://app.staging.example.com', profiles.staging?.customConfig)).toBe(
      'https://app.staging.example.com'
    );
  });
});
