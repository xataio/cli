import { describe, expect, mock, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { printTable } from '~/lib/cli-utils';
import { implementation } from './list';

const member = { id: 'usr_1', email: 'ada@example.com', name: 'Ada', role: 'editor' };

function buildContext({ outputJson }: { outputJson: boolean }) {
  const stdout: string[] = [];
  const context = {
    api: {
      organizations: {
        listOrganizationMembers: mock(async () => ({ members: [member] }))
      }
    },
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: () => true },
      exit: mock(() => undefined)
    },
    outputJson,
    printTable,
    getOrganization: mock(async () => 'org-id')
  } as unknown as LocalContext;

  return { context, stdout };
}

describe('organization members list', () => {
  test('shows each member role label in the table', async () => {
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

    expect(JSON.parse(stdout.join(''))).toEqual([member]);
  });
});
