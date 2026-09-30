/* biome-ignore-all lint/style/noProcessEnv: The CLI runs in a child process that needs PATH */

import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const issuer = Bun.serve({
  port: 0,
  fetch: () => Response.json({ access_token: 'new', refresh_token: 'new-refresh', expires_in: 300 })
});
afterAll(() => issuer.stop(true));

test('a token refresh keeps the profile console URL', async () => {
  const configDir = mkdtempSync(path.join(tmpdir(), 'xata-refresh-'));
  const configFile = path.join(configDir, 'xata', 'config.json');
  mkdirSync(path.dirname(configFile));
  const customConfig = {
    issuer: `http://127.0.0.1:${issuer.port}`,
    clientId: 'cli',
    clientSecret: 'secret',
    apiBaseUrl: 'https://api.staging.example.com',
    consoleUrl: 'https://app.staging.example.com'
  };
  const profile = { type: 'oidc', accessToken: 'old', refreshToken: 'old', expiresAt: new Date(0), customConfig };
  writeFileSync(configFile, JSON.stringify({ activeProfile: 'staging', profiles: { staging: profile } }));

  const cli = Bun.spawn([process.execPath, 'src/bin/cli.ts', 'auth', 'refresh', '--profile', 'staging'], {
    cwd: `${import.meta.dir}/../../..`,
    env: { HOME: configDir, PATH: process.env.PATH, XATA_CONFIG_DIR: configDir },
    stdout: 'pipe',
    stderr: 'pipe'
  });
  expect(await cli.exited).toBe(0);

  const written = JSON.parse(readFileSync(configFile, 'utf8'));
  expect(written.profiles.staging).toMatchObject({ accessToken: 'new', customConfig });
});
