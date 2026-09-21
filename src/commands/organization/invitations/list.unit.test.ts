import { describe, expect, mock, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { printTable } from '~/lib/cli-utils';
import { implementation } from './list';

const invitation = {
  id: 'inv_1',
  email: 'ada@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  role: 'editor',
  status: 'pending',
  expires_at: '2026-09-21T00:00:00.000Z'
};

function buildContext({ outputJson }: { outputJson: boolean }) {
  const stdout: string[] = [];
  const context = {
    api: {
      organizations: {
        listOrganizationInvitations: mock(async () => ({ invitations: [invitation] }))
      }
    },
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: () => true },
      exit: mock((code?: number) => {
        throw new Error(`exit:${code}`);
      })
    },
    outputJson,
    printTable,
    getOrganization: mock(async () => 'org-id')
  } as unknown as LocalContext;

  return { context, stdout };
}

describe('organization invitations list', () => {
  test('shows each invitation role label in the table', async () => {
    const { context, stdout } = buildContext({ outputJson: false });

    await implementation.call(context, {});

    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('role');
    expect(output).toContain('Editor');
    expect(output).not.toContain('editor');
  });

  test('includes the role in JSON', async () => {
    const { context, stdout } = buildContext({ outputJson: true });

    await implementation.call(context, {});

    expect(JSON.parse(stdout.join(''))).toEqual([invitation]);
  });
});
