import { describe, expect, mock, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LocalContext } from '~/context';
import {
  buildPostgresEnvironment,
  newScratchBranchName,
  resolveExecutable,
  waitForBranchReady
} from './scratch-session';

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

  test('keeps the original connection string but parses without sslmode', () => {
    const environment = buildPostgresEnvironment(
      'postgresql://alice:secret@db.example.com:5433/postgres?sslmode=require',
      'app'
    );

    expect(environment.DATABASE_URL).toBe('postgresql://alice:secret@db.example.com:5433/postgres?sslmode=require');
    expect(environment.PGHOST).toBe('db.example.com');
    expect(environment.PGSSLMODE).toBe('require');
  });

  test('defaults the port when the connection string omits it', () => {
    const environment = buildPostgresEnvironment('postgresql://alice:secret@db.example.com/postgres', 'app');
    expect(environment.PGPORT).toBe('5432');
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

describe('waitForBranchReady', () => {
  test('polls until the branch is healthy', async () => {
    let calls = 0;
    const describeBranch = mock(async () => {
      calls += 1;
      return {
        id: 'branch-1',
        name: 'scratch',
        status: { statusType: calls > 1 ? 'STATUS_TYPE_HEALTHY' : 'STATUS_TYPE_PROVISIONING' }
      };
    });
    const context = { api: { branches: { describeBranch } } } as unknown as LocalContext;

    const branch = await waitForBranchReady(context, 'org', 'proj', 'branch-1');

    expect(branch.status.statusType).toBe('STATUS_TYPE_HEALTHY');
    expect(describeBranch).toHaveBeenCalledTimes(2);
  });

  test('throws when the branch does not become healthy in time', async () => {
    const describeBranch = mock(async () => ({
      id: 'branch-1',
      name: 'scratch',
      status: { statusType: 'STATUS_TYPE_PROVISIONING' }
    }));
    const context = { api: { branches: { describeBranch } } } as unknown as LocalContext;

    await expect(waitForBranchReady(context, 'org', 'proj', 'branch-1', { timeoutMs: 0 })).rejects.toThrow(
      'Timed out waiting for branch scratch to become ready.'
    );
  });

  test('throws immediately when the signal is already aborted', async () => {
    const describeBranch = mock(async () => ({
      id: 'branch-1',
      name: 'scratch',
      status: { statusType: 'STATUS_TYPE_PROVISIONING' }
    }));
    const context = { api: { branches: { describeBranch } } } as unknown as LocalContext;
    const abort = new AbortController();
    abort.abort();

    await expect(waitForBranchReady(context, 'org', 'proj', 'branch-1', { signal: abort.signal })).rejects.toThrow(
      'Cancelled while waiting for the branch to become ready.'
    );
    expect(describeBranch).not.toHaveBeenCalled();
  });
});
