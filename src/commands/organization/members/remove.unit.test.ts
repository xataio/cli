import { describe, expect, mock, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { implementation } from './remove';

class ExitCalled extends Error {}

function buildContext({ members, outputJson }: { members: { id: string; email: string }[]; outputJson: boolean }) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exit = mock((_code?: number) => {
    throw new ExitCalled();
  });
  const context = {
    api: { organizations: { listOrganizationMembers: mock(async () => ({ members })) } },
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      exit
    },
    enquirer: { selectPrompt: mock(async () => undefined) },
    isInteractive: false,
    outputJson,
    getOrganization: mock(async () => 'org-id')
  } as unknown as LocalContext;

  return { context, stdout, stderr, exit };
}

async function run(context: LocalContext, flags: { 'user-id'?: string }) {
  try {
    await implementation.call(context, { force: true, ...flags });
  } catch (error) {
    if (!(error instanceof ExitCalled)) throw error;
  }
}

const member = { id: 'usr_1', email: 'someone@example.com' };

describe('organization members remove failures', () => {
  test('reports an unknown user as JSON on stderr when --json was asked for', async () => {
    const { context, stdout, stderr, exit } = buildContext({ members: [member], outputJson: true });

    await run(context, { 'user-id': 'usr_missing' });

    expect(stdout).toEqual([]);
    expect(JSON.parse(stderr.join(''))).toEqual({
      success: false,
      error: 'User with ID usr_missing not found in organization',
      userId: 'usr_missing'
    });
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('reports an organization without members as JSON on stderr', async () => {
    const { context, stdout, stderr, exit } = buildContext({ members: [], outputJson: true });

    await run(context, { 'user-id': 'usr_1' });

    expect(stdout).toEqual([]);
    expect(JSON.parse(stderr.join(''))).toEqual({
      success: false,
      error: 'No members found in this organization',
      organization: 'org-id'
    });
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('reports a missing user ID as JSON on stderr', async () => {
    const { context, stdout, stderr, exit } = buildContext({ members: [member], outputJson: true });

    await run(context, {});

    expect(stdout).toEqual([]);
    expect(JSON.parse(stderr.join(''))).toEqual({
      success: false,
      error: 'User ID is required',
      organization: 'org-id'
    });
    expect(exit).toHaveBeenCalledWith(1);
  });

  test('keeps the human message when --json was not asked for', async () => {
    const { context, stdout, stderr, exit } = buildContext({ members: [member], outputJson: false });

    await run(context, { 'user-id': 'usr_missing' });

    const output = stripAnsi(stderr.join(''));
    expect(stdout).toEqual([]);
    expect(output).toContain('User with ID usr_missing not found in organization\n');
    expect(() => JSON.parse(output)).toThrow();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
