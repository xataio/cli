import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LocalContext } from '~/context';
import { buildPostgresEnvironment, newScratchBranchName, resolveExecutable } from './scratch-session';

describe('newScratchBranchName', () => {
  test('generates unique scratch-prefixed names', () => {
    const first = newScratchBranchName();
    const second = newScratchBranchName();
    expect(first).toStartWith('scratch-');
    expect(second).toStartWith('scratch-');
    expect(first).not.toBe(second);
  });
});

describe('buildPostgresEnvironment', () => {
  test('maps connection string parts to PG* variables', () => {
    const environment = buildPostgresEnvironment('postgresql://alice:secret@db.example.com:5433/postgres', 'app');

    expect(environment.DATABASE_URL).toBe('postgresql://alice:secret@db.example.com:5433/postgres');
    expect(environment.XATA_DATABASE_URL).toBe('postgresql://alice:secret@db.example.com:5433/postgres');
    expect(environment.PGHOST).toBe('db.example.com');
    expect(environment.PGPORT).toBe('5433');
    expect(environment.PGUSER).toBe('alice');
    expect(environment.PGPASSWORD).toBe('secret');
    expect(environment.PGDATABASE).toBe('app');
    expect(environment.PGSSLMODE).toBe('require');
  });
});

describe('resolveExecutable', () => {
  test('finds an executable on PATH and returns null otherwise', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scratch-session-'));
    try {
      const binary = path.join(directory, 'fake-psql');
      fs.writeFileSync(binary, '#!/bin/sh\n', { mode: 0o755 });

      const context = {
        process: { env: { PATH: directory }, platform: process.platform },
        fs,
        path
      } as unknown as LocalContext;

      expect(resolveExecutable(context, 'fake-psql')).toBe(binary);
      expect(resolveExecutable(context, 'missing-binary')).toBeNull();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
