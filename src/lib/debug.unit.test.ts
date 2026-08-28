import { describe, expect, test } from 'bun:test';
import { maskSecrets, redact } from './debug';

describe('maskSecrets', () => {
  test('masks the password in a postgres connection string', () => {
    expect(maskSecrets('source-url', 'postgresql://user:hunter2@host:5432/db')).toBe(
      'postgresql://user:******@host:5432/db'
    );
  });

  test('keeps the query parameters of a connection string', () => {
    expect(maskSecrets('postgres-url', 'postgresql://user:hunter2@host:5432/db?sslmode=require')).toBe(
      'postgresql://user:******@host:5432/db?sslmode=require'
    );
  });

  test('masks a password on a url that is not postgres, keeping its scheme', () => {
    expect(maskSecrets('endpoint', 'https://user:tok@api.example.com/x')).toBe('https://user:******@api.example.com/x');
  });

  test('leaves a url without a password alone', () => {
    expect(maskSecrets('endpoint', 'https://api.xata.io/branches')).toBe('https://api.xata.io/branches');
  });

  test('leaves values that are not urls alone', () => {
    expect(maskSecrets('branch', 'main')).toBe('main');
    expect(maskSecrets('snapshot-tables', '*.*')).toBe('*.*');
    expect(maskSecrets('dump-file', '/tmp/dump.sql')).toBe('/tmp/dump.sql');
  });

  test('masks a value whose flag name marks it as a secret', () => {
    expect(maskSecrets('api-key', 'xau_live')).toBe('******');
    expect(maskSecrets('client-secret', 'shh')).toBe('******');
  });
});

describe('redact', () => {
  test('walks nested objects and arrays', () => {
    expect(redact({ flags: { 'postgres-url': 'postgresql://u:p@h/d' }, args: ['postgresql://u:p@h/d'] })).toEqual({
      flags: { 'postgres-url': 'postgresql://u:******@h/d' },
      args: ['postgresql://u:******@h/d']
    });
  });

  test('leaves non-secret values untouched', () => {
    expect(redact({ branch: 'main', verbose: true, retries: 3, missing: undefined })).toEqual({
      branch: 'main',
      verbose: true,
      retries: 3,
      missing: undefined
    });
  });
});
