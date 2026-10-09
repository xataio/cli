import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnvFile } from './load-env-file';

const keys = ['LOAD_ENV_FILE_NEW', 'LOAD_ENV_FILE_QUOTED', 'LOAD_ENV_FILE_SET'];

afterEach(() => {
  for (const key of keys) {
    delete Bun.env[key];
  }
});

describe('loadEnvFile', () => {
  test('loads unset keys without overriding existing ones', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-env-file-'));
    const file = path.join(dir, '.env.local');
    fs.writeFileSync(file, 'LOAD_ENV_FILE_NEW=new\nLOAD_ENV_FILE_QUOTED="a b # c"\nLOAD_ENV_FILE_SET=file\n');
    Bun.env.LOAD_ENV_FILE_SET = 'shell';

    loadEnvFile(file);

    expect(Bun.env.LOAD_ENV_FILE_NEW).toBe('new');
    expect(Bun.env.LOAD_ENV_FILE_QUOTED).toBe('a b # c');
    expect(Bun.env.LOAD_ENV_FILE_SET).toBe('shell');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('ignores a missing file', () => {
    expect(() => loadEnvFile(path.join(os.tmpdir(), 'does-not-exist', '.env.local'))).not.toThrow();
  });
});
