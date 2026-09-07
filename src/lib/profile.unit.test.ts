import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Config } from './schemas';

const configState: Config = { activeProfile: 'default', profiles: {} };

mock.module('./config', () => ({ config: configState }));

const { getProfileFlag, resolveProfile } = await import('./profile');

const oidcProfile = { type: 'oidc', accessToken: 'a', refreshToken: 'r', expiresAt: new Date(0) } as const;

describe('getProfileFlag', () => {
  test('reads the flag from its own argument', () => {
    expect(getProfileFlag(['branch', 'list', '--profile', 'staging'])).toBe('staging');
  });

  test('reads the flag from an inline value', () => {
    expect(getProfileFlag(['branch', 'list', '--profile=staging'])).toBe('staging');
  });

  test('reads the flag next to other flags', () => {
    expect(getProfileFlag(['branch', 'list', '--json', '--profile', 'staging', '--organization', 'org'])).toBe(
      'staging'
    );
  });

  test('returns undefined when the flag is not passed', () => {
    expect(getProfileFlag(['branch', 'list', '--json'])).toBeUndefined();
  });

  test('does not read a child command flag after --', () => {
    expect(getProfileFlag(['scratch', '--', 'psql', '--profile', 'child'])).toBeUndefined();
  });

  test('returns undefined when the flag has no value', () => {
    expect(getProfileFlag(['branch', 'list', '--profile'])).toBeUndefined();
  });
});

describe('resolveProfile', () => {
  beforeEach(() => {
    configState.activeProfile = 'work';
    configState.profiles = { work: oidcProfile, personal: oidcProfile };
  });

  test('resolves a named profile to its own credentials', () => {
    expect(resolveProfile({ profileFlag: 'personal' })).toEqual({ profile: 'personal', profileData: oidcProfile });
  });

  test('falls back to the active profile when no name is given', () => {
    expect(resolveProfile({})).toEqual({ profile: 'work', profileData: oidcProfile });
    expect(resolveProfile({ profileFlag: '' })).toEqual({ profile: 'work', profileData: oidcProfile });
  });

  test('reports a mistyped name instead of the active profile it resembles', () => {
    expect(resolveProfile({ profileFlag: 'personl' })).toEqual({ profile: 'personl', profileData: undefined });
  });

  test('has no credentials when nothing is logged in', () => {
    configState.profiles = {};

    expect(resolveProfile({})).toEqual({ profile: 'default', profileData: undefined });
  });
});
