import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const buildDir = mkdtempSync(path.join(tmpdir(), 'xata-upgrade-build-'));
const entrypoint = path.join(buildDir, 'upgrade.ts');
const binary = path.join(buildDir, 'upgrade');
const replacement = '#!/bin/sh\necho upgraded\n';
let directory: string;
let installed: string;
let homeBinary: string;

beforeAll(() => {
  writeFileSync(
    entrypoint,
    `import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { implementation } from ${JSON.stringify(path.resolve(import.meta.dir, '../../src/commands/upgrade.ts'))};

const mode = process.argv[2];
const data = mode === 'current' ? readFileSync(process.execPath) : ${JSON.stringify(replacement)};
const checksum = createHash('sha256').update(data).digest('hex');
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.endsWith('/manifest.json')) {
    return Response.json({ targets: {
      [process.platform + '-' + process.arch]: {
        sha256sum: mode === 'corrupt' ? '0'.repeat(64) : checksum,
        url: 'https://test.invalid/binary'
      }
    } });
  }
  if (url === 'https://test.invalid/binary') {
    if (mode === 'current') throw new Error('An up-to-date CLI must not download itself');
    return new Response(data);
  }
  throw new Error('Network disabled in upgrade test');
};
await implementation.call({ process, env: {} }, { channel: 'latest' });
`
  );
  const build = Bun.spawnSync([process.execPath, 'build', '--compile', entrypoint, '--outfile', binary], {
    stdout: 'pipe',
    stderr: 'pipe'
  });
  expect(build.exitCode, build.stderr.toString()).toBe(0);
}, 60_000);

afterAll(() => rmSync(buildDir, { recursive: true, force: true }));

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), 'xata-upgrade-test-'));
  installed = path.join(directory, 'custom install', 'renamed-xata');
  homeBinary = path.join(directory, 'home', '.config', 'xata', 'bin', 'xata');
  mkdirSync(path.dirname(installed), { recursive: true });
  mkdirSync(path.dirname(homeBinary), { recursive: true });
  copyFileSync(binary, installed);
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

const runUpgrade = (cmd: string[]) =>
  Bun.spawnSync(cmd, {
    env: { HOME: path.join(directory, 'home'), XDG_CONFIG_HOME: path.join(directory, 'home', '.config') },
    stdout: 'pipe',
    stderr: 'pipe'
  });

test('upgrades the running binary through a symlink even when the HOME installation is already current', () => {
  writeFileSync(homeBinary, replacement);
  const link = path.join(directory, 'xata');
  symlinkSync(installed, link);

  const result = runUpgrade([link]);

  expect(result.exitCode, result.stderr.toString()).toBe(0);
  expect(result.stdout.toString()).toContain('CLI has been upgraded successfully.');
  expect(readFileSync(installed, 'utf8')).toBe(replacement);
  expect(statSync(installed).mode & 0o777).toBe(0o755);
  expect(lstatSync(link).isSymbolicLink()).toBe(true);
  expect(readFileSync(homeBinary, 'utf8')).toBe(replacement);
});

test('checks the running binary for an already-current version, leaving other installations alone', () => {
  writeFileSync(homeBinary, 'other installation');
  const before = statSync(installed);

  const result = runUpgrade([installed, 'current']);

  expect(result.exitCode, result.stderr.toString()).toBe(0);
  expect(result.stdout.toString()).toContain('CLI is already up to date.');
  expect(statSync(installed).ino).toBe(before.ino);
  expect(readFileSync(homeBinary, 'utf8')).toBe('other installation');
});

test('rejects a corrupt download without replacing either installation', () => {
  writeFileSync(homeBinary, 'other installation');
  const before = readFileSync(installed);

  const result = runUpgrade([installed, 'corrupt']);

  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain('SHA256 checksum verification failed');
  expect(readFileSync(installed).equals(before)).toBe(true);
  expect(readFileSync(homeBinary, 'utf8')).toBe('other installation');
});

test('refuses source-mode upgrades without replacing Bun or the HOME installation', () => {
  writeFileSync(homeBinary, 'other installation');
  const bunCopy = path.join(directory, 'bun');
  copyFileSync(process.execPath, bunCopy);
  const before = createHash('sha256').update(readFileSync(bunCopy)).digest('hex');

  const result = runUpgrade([bunCopy, entrypoint]);

  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain('Self-upgrade is only supported by the compiled Xata CLI');
  expect(createHash('sha256').update(readFileSync(bunCopy)).digest('hex')).toBe(before);
  expect(readFileSync(homeBinary, 'utf8')).toBe('other installation');
});
