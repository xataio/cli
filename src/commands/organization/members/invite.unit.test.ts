import { describe, expect, mock, test } from 'bun:test';
import { ApiError } from '@xata.io/api';
import type { LocalContext } from '~/context';
import { implementation } from './invite';

class ExitCalled extends Error {}

type Options = {
  isInteractive?: boolean;
  rolesEnabled?: boolean;
  promptedRole?: string;
};

function buildContext({ isInteractive = false, rolesEnabled = true, promptedRole = '' }: Options = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const createOrganizationInvitation = mock(async (_options: { body: Record<string, unknown> }) => undefined);
  const listOrganizationRoles = mock(async () => {
    if (!rolesEnabled) {
      throw new ApiError(404, {}, 'roles are not enabled for this organization');
    }
    return { roles: [] };
  });
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

  test('prompts for a role in a terminal when roles are enabled', async () => {
    const { context, createOrganizationInvitation, selectPrompt } = buildContext({
      isInteractive: true,
      promptedRole: 'editor'
    });

    await run(context, { email: 'ada@example.com' });

    expect(selectPrompt).toHaveBeenCalled();
    expect(createOrganizationInvitation.mock.calls[0]?.[0].body).toEqual({ email: 'ada@example.com', role: 'editor' });
  });

  test('does not prompt for a role in a terminal when roles are disabled', async () => {
    const { context, createOrganizationInvitation, selectPrompt } = buildContext({
      isInteractive: true,
      rolesEnabled: false
    });

    await run(context, { email: 'ada@example.com' });

    expect(selectPrompt).not.toHaveBeenCalled();
    expect(createOrganizationInvitation.mock.calls[0]?.[0].body).toStrictEqual({ email: 'ada@example.com' });
  });

  test('refuses --role without sending the invitation when roles are disabled', async () => {
    const { context, stderr, createOrganizationInvitation } = buildContext({ rolesEnabled: false });

    await run(context, { email: 'ada@example.com', role: 'editor' });

    expect(context.process.exit).toHaveBeenCalledWith(1);
    expect(stderr.join('')).toContain('Roles are not enabled for this organization');
    expect(createOrganizationInvitation).not.toHaveBeenCalled();
  });
});
