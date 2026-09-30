import { buildApplication, buildRouteMap, run } from '@stricli/core';
import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { parse } from 'yaml';
import type { LocalContext } from '~/context';
import * as ai from '~/lib/ai';
import * as binary from '~/lib/binary/utils';
import * as pgstream from '~/lib/pgstream/validate-rules';
import { CloneConfigCommand, implementation } from './config';

afterEach(() => mock.restore());

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

test('a config pgstream rejects goes back to the AI with the errors and the rejected config', async () => {
  const files = new Map<string, string>();
  const stdout: string[] = [];
  const column = (name: string) => ({ name, type: 'text' });
  const users = {
    name: 'users',
    columns: { id: column('id'), email: column('email') },
    primaryKey: [],
    foreignKeys: {}
  };
  const schema = [{ name: 'public', tables: { users } }];
  const context = {
    isInteractive: true,
    env: {},
    fs: {
      existsSync: (file: string) => files.has(file),
      readFileSync: (file: string) => files.get(file),
      writeFileSync: (file: string, content: string) => files.set(file, content)
    },
    postgres: async () => ({ unsafe: async () => schema, end: async () => {} }),
    getOrganization: async () => 'org-a',
    process: { stdout: { write: (chunk: string) => stdout.push(chunk) }, stderr: { write: mock() }, exit: mock() }
  } as unknown as LocalContext;
  spyOn(binary, 'checkBranchIsReachable').mockResolvedValue({} as never);
  const generateCloneConfigWithXata = spyOn(ai, 'generateCloneConfigWithXata');
  const validateCloneRulesWithPgstream = spyOn(pgstream, 'validateCloneRulesWithPgstream');
  const email = { schema: 'public', table: 'users', column: 'email' };
  generateCloneConfigWithXata
    .mockResolvedValueOnce([{ ...email, name: 'masking' }])
    .mockResolvedValueOnce([{ ...email, name: 'neosync_email' }]);
  validateCloneRulesWithPgstream
    .mockResolvedValueOnce({ valid: false, errors: ['masking cannot handle email'], exitCode: 1, rawJson: {} })
    .mockResolvedValueOnce({ valid: true, errors: [], exitCode: 0, rawJson: {} });

  await implementation.call(context, { 'source-url': 'postgres://source', mode: 'ai', 'validation-mode': 'strict' });

  const [, retry] = generateCloneConfigWithXata.mock.calls;
  expect(retry?.[2].prompt).toContain('masking cannot handle email');
  expect(retry?.[2].currentConfig).toContain('name: masking');
  const written = parse([...files.values()][0] ?? '');
  expect(written.transformations.table_transformers[0].column_transformers).toEqual({
    email: { name: 'neosync_email' },
    id: { name: 'noop' }
  });
  expect(stdout.join('')).toContain('passed pgstream validation on attempt 2');
});
