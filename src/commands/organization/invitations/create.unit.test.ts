import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { implementation } from './create';

class ExitCalled extends Error {}

type Options = {
  isInteractive?: boolean;
};

function buildContext({ isInteractive = false }: Options = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const createOrganizationInvitation = mock(async (_options: { body: Record<string, unknown> }) => undefined);
  const listOrganizationRoles = mock(async () => ({ roles: [] }));
  const selectPrompt = mock(async () => '');

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
    outputJson: true,
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

describe('organization invitations create', () => {
  test('sends the role given with --role', async () => {
    const { context, stdout, createOrganizationInvitation } = buildContext();

    await run(context, { email: 'ada@example.com', role: 'editor' });

    expect(createOrganizationInvitation.mock.calls[0]?.[0].body).toEqual({ email: 'ada@example.com', role: 'editor' });
    expect(JSON.parse(stdout.join(''))).toEqual({
      success: true,
      email: 'ada@example.com',
      role: 'editor',
      organization: 'org-id'
    });
  });

  test('sends no role and reports none when --json skips the prompt', async () => {
    const { context, stdout, createOrganizationInvitation, selectPrompt } = buildContext({ isInteractive: true });

    await run(context, { email: 'ada@example.com' });

    expect(selectPrompt).not.toHaveBeenCalled();
    expect(createOrganizationInvitation.mock.calls[0]?.[0].body).toStrictEqual({ email: 'ada@example.com' });
    expect(JSON.parse(stdout.join(''))).toEqual({ success: true, email: 'ada@example.com', organization: 'org-id' });
  });
});
