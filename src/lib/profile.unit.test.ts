import { describe, expect, test } from 'bun:test';
import { getProfileFlag } from './profile';

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

  test('returns undefined when the flag has no value', () => {
    expect(getProfileFlag(['branch', 'list', '--profile'])).toBeUndefined();
  });
});
