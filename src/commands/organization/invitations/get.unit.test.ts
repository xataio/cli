import { describe, expect, mock, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { printDetails } from '~/lib/cli-utils';
import { implementation } from './get';

const invitation = {
  id: 'inv_1',
  email: 'ada@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  role: 'editor',
  status: 'pending',
  created_at: '2026-09-14T00:00:00.000Z',
  expires_at: '2026-09-21T00:00:00.000Z'
};

function buildContext({ outputJson }: { outputJson: boolean }) {
  const stdout: string[] = [];
  const context = {
    api: {
      organizations: {
        getOrganizationInvitation: mock(async () => invitation)
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
    printDetails,
    getOrganization: mock(async () => 'org-id')
  } as unknown as LocalContext;

  return { context, stdout };
}

describe('organization invitations get', () => {
  test('shows the invitation role label in the details', async () => {
    const { context, stdout } = buildContext({ outputJson: false });

    await implementation.call(context, { 'invitation-id': 'inv_1' });

    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('role');
    expect(output).toContain('Editor');
    expect(output).not.toContain('editor');
  });

  test('includes the role in JSON', async () => {
    const { context, stdout } = buildContext({ outputJson: true });

    await implementation.call(context, { 'invitation-id': 'inv_1' });

    expect(JSON.parse(stdout.join(''))).toEqual(invitation);
  });
});
