import { describe, expect, mock, test } from 'bun:test';
import { ApiError } from '@xata.io/api';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { implementation } from './set-role';

class ExitCalled extends Error {}

const MEMBER = { id: 'usr_1', email: 'ada@example.com', name: 'Ada', role: 'admin' };

type Options = {
  setRoleError?: ApiError;
  outputJson?: boolean;
  isInteractive?: boolean;
  promptedValue?: string;
};

function buildContext({ setRoleError, outputJson = true, isInteractive = false, promptedValue = '' }: Options = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const setOrganizationMemberRole = mock(async (_options: { body: Record<string, unknown> }) => {
    if (setRoleError) {
      throw setRoleError;
    }
  });
  const selectPrompt = mock(
    async (_isInteractive: boolean, _message: string, _choices: unknown[], _options?: unknown) => promptedValue
  );

  const context = {
    api: {
      organizations: {
        setOrganizationMemberRole,
        listOrganizationMembers: mock(async () => ({ members: [MEMBER] }))
      }
    },
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      exit: mock(() => {
        throw new ExitCalled();
      })
    },
    isInteractive,
    outputJson,
    getOrganization: mock(async () => 'org-id'),
    enquirer: { selectPrompt }
  } as unknown as LocalContext;

  return { context, stdout, stderr, setOrganizationMemberRole, selectPrompt };
}

async function run(context: LocalContext, flags: { 'user-id'?: string; role?: 'admin' | 'editor' | 'viewer' }) {
  try {
    await implementation.call(context, flags);
  } catch (error) {
    if (!(error instanceof ExitCalled)) throw error;
  }
}

const failure = (stderr: string[]) => JSON.parse(stderr.join(''));

describe('organization members set-role', () => {
  test('sets the role and reports it as JSON', async () => {
    const { context, stdout, setOrganizationMemberRole } = buildContext();

    await run(context, { 'user-id': 'usr_1', role: 'viewer' });

    expect(setOrganizationMemberRole.mock.calls[0]?.[0].body).toEqual({ role: 'viewer' });
    expect(JSON.parse(stdout.join(''))).toEqual({
      success: true,
      userId: 'usr_1',
      role: 'viewer',
      organization: 'org-id'
    });
  });

  test('prompts for the role in a terminal, starting on the current one', async () => {
    const { context, setOrganizationMemberRole, selectPrompt } = buildContext({
      isInteractive: true,
      outputJson: false,
      promptedValue: 'editor'
    });

    await run(context, { 'user-id': 'usr_1' });

    expect(selectPrompt.mock.calls[0]?.[3]).toEqual({ initial: 0 });
    expect(setOrganizationMemberRole.mock.calls[0]?.[0].body).toEqual({ role: 'editor' });
  });

  test('requires a user ID when it cannot prompt', async () => {
    const { context, stderr, setOrganizationMemberRole } = buildContext();

    await run(context, { role: 'viewer' });

    expect(failure(stderr)).toEqual({ success: false, error: 'User ID is required', organization: 'org-id' });
    expect(setOrganizationMemberRole).not.toHaveBeenCalled();
  });

  test('requires a role when it cannot prompt', async () => {
    const { context, stderr, setOrganizationMemberRole } = buildContext();

    await run(context, { 'user-id': 'usr_1' });

    expect(failure(stderr)).toEqual({ success: false, error: 'Role is required', userId: 'usr_1' });
    expect(setOrganizationMemberRole).not.toHaveBeenCalled();
  });

  test('reports the API refusing the change as JSON', async () => {
    const { context, stdout, stderr } = buildContext({
      setRoleError: new ApiError(404, {}, 'roles are not enabled for this organization')
    });

    await run(context, { 'user-id': 'usr_1', role: 'viewer' });

    expect(stdout).toEqual([]);
    expect(failure(stderr)).toEqual({
      success: false,
      error: 'Failed to set role: roles are not enabled for this organization',
      userId: 'usr_1',
      role: 'viewer'
    });
  });

  test('keeps the human message without --json', async () => {
    const { context, stderr } = buildContext({
      setRoleError: new ApiError(403, {}, 'Forbidden'),
      outputJson: false
    });

    await run(context, { 'user-id': 'usr_1', role: 'viewer' });

    expect(stripAnsi(stderr.join(''))).toBe('Failed to set role: Forbidden\n');
  });
});
