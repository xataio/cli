import { buildApplication, buildRouteMap, run } from '@stricli/core';
import { expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { CloneConfigCommand } from './config';

test('an unknown --model is a usage error before anything runs', async () => {
  const app = buildApplication(buildRouteMap({ docs: { brief: '' }, routes: { config: CloneConfigCommand } }), {
    name: 'xata'
  });
  const stderr = mock();
  const getOrganization = mock();
  const context = { process: { stdout: { write: mock() }, stderr: { write: stderr } }, getOrganization };
  await run(app, ['config', '--mode', 'ai', '--model', 'gpt-4'], context as unknown as LocalContext);
  expect((context.process as { exitCode?: number }).exitCode).not.toBe(0);
  expect(stderr.mock.calls.join('')).toContain('gpt-4');
  expect(getOrganization).not.toHaveBeenCalled();
});
