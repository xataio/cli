import { describe, expect, it } from 'bun:test';
import { isVersionNewer } from './commands';

describe('isVersionNewer', () => {
  it('returns true when major version is newer', () => {
    expect(isVersionNewer('2.0.0', '1.0.0')).toBe(true);
  });

  it('returns true when minor version is newer', () => {
    expect(isVersionNewer('0.16.0', '0.14.0')).toBe(true);
  });

  it('returns true when patch version is newer', () => {
    expect(isVersionNewer('0.14.4', '0.14.3')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(isVersionNewer('0.16.1', '0.16.1')).toBe(false);
  });

  it('returns false when a is older than b (major)', () => {
    expect(isVersionNewer('1.0.0', '2.0.0')).toBe(false);
  });

  it('returns false when a is older than b (minor)', () => {
    expect(isVersionNewer('0.14.0', '0.16.0')).toBe(false);
  });

  it('returns false when a is older than b (patch)', () => {
    expect(isVersionNewer('0.14.2', '0.14.3')).toBe(false);
  });

  it('handles v prefix on both versions', () => {
    expect(isVersionNewer('v0.16.1', 'v0.14.3')).toBe(true);
  });

  it('handles v prefix on only one version', () => {
    expect(isVersionNewer('v0.16.1', '0.14.3')).toBe(true);
    expect(isVersionNewer('0.16.1', 'v0.14.3')).toBe(true);
  });

  it('returns false for invalid version strings', () => {
    expect(isVersionNewer('development', '0.14.3')).toBe(false);
    expect(isVersionNewer('0.14.3', 'development')).toBe(false);
    expect(isVersionNewer('invalid', 'also-invalid')).toBe(false);
  });

  it('returns false for incomplete version strings', () => {
    expect(isVersionNewer('0.14', '0.14.3')).toBe(false);
    expect(isVersionNewer('14', '0.14.3')).toBe(false);
  });

  it('handles realistic pgroll version mismatch scenario', () => {
    // Schema at 0.16.1, binary at 0.14.3 — should trigger hint
    expect(isVersionNewer('0.16.1', '0.14.3')).toBe(true);
    // Binary at 0.16.1, schema at 0.14.3 — pgroll auto-reinits, no hint
    expect(isVersionNewer('0.14.3', '0.16.1')).toBe(false);
  });
});
