import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { implementation } from './create';

function buildContext() {
  const createOrganizationInvitation = mock(async (_options: { body: Record<string, unknown> }) => undefined);

  const context = {
    api: { organizations: { createOrganizationInvitation } },
    process: {
      stdout: { write: () => true },
      stderr: { write: () => true },
      exit: mock((code?: number) => {
        throw new Error(`exit:${code}`);
      })
    },
    isInteractive: false,
    outputJson: false,
    getOrganization: mock(async () => 'org-id'),
    enquirer: {
      inputPrompt: mock(async (_isInteractive: boolean, _message: string, options?: { flag?: string }) => {
        return options?.flag ?? '';
      })
    }
  } as unknown as LocalContext;

  return { context, createOrganizationInvitation };
}

describe('organization invitations create', () => {
  test('sends the role given with --role', async () => {
    const { context, createOrganizationInvitation } = buildContext();

    await implementation.call(context, { email: 'ada@example.com', role: 'editor' });

    expect(createOrganizationInvitation.mock.calls[0]?.[0].body).toEqual({ email: 'ada@example.com', role: 'editor' });
  });
});
