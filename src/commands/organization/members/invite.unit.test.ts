import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { implementation } from './invite';

class ExitCalled extends Error {}

type Options = {
  isInteractive?: boolean;
  promptedRole?: string;
};

function buildContext({ isInteractive = false, promptedRole = '' }: Options = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const createOrganizationInvitation = mock(async (_options: { body: Record<string, unknown> }) => undefined);
  const listOrganizationRoles = mock(async () => ({
    roles: [
      { id: 'admin', name: 'Admin', description: '' },
      { id: 'editor', name: 'Editor', description: '' }
    ]
  }));
  const selectPrompt = mock(async () => promptedRole);

  const context = {
    api: { organizations: { createOrganizationInvitation, listOrganizationRoles } },
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      exit: mock(() => {
        throw new ExitCalled();
      })
    },
    isInteractive,
    outputJson: false,
    getOrganization: mock(async () => 'org-id'),
    enquirer: {
      selectPrompt,
      inputPrompt: mock(async (_isInteractive: boolean, _message: string, options?: { flag?: string }) => {
        return options?.flag ?? '';
      })
    }
  } as unknown as LocalContext;

  return { context, stdout, stderr, createOrganizationInvitation, selectPrompt };
}

async function run(context: LocalContext, flags: { email?: string; role?: 'admin' | 'editor' }) {
  try {
    await implementation.call(context, flags);
  } catch (error) {
    if (!(error instanceof ExitCalled)) throw error;
  }
}

describe('organization members invite', () => {
  test('invites without a role when none was given and it cannot prompt', async () => {
    const { context, createOrganizationInvitation, selectPrompt } = buildContext();

    await run(context, { email: 'ada@example.com' });

    expect(selectPrompt).not.toHaveBeenCalled();
    expect(createOrganizationInvitation.mock.calls[0]?.[0].body).toStrictEqual({ email: 'ada@example.com' });
  });

  test('prompts for a role in a terminal', async () => {
    const { context, createOrganizationInvitation, selectPrompt } = buildContext({
      isInteractive: true,
      promptedRole: 'editor'
    });

    await run(context, { email: 'ada@example.com' });

    expect(selectPrompt).toHaveBeenCalled();
    expect(createOrganizationInvitation.mock.calls[0]?.[0].body).toEqual({ email: 'ada@example.com', role: 'editor' });
  });
});
