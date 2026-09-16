import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { implementation } from './invite';

function buildContext() {
  const createOrganizationInvitation = mock(async (_options: { body: Record<string, unknown> }) => undefined);
  const selectPrompt = mock(async () => '');

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
      selectPrompt,
      inputPrompt: mock(async (_isInteractive: boolean, _message: string, options?: { flag?: string }) => {
        return options?.flag ?? '';
      })
    }
  } as unknown as LocalContext;

  return { context, createOrganizationInvitation, selectPrompt };
}

describe('organization members invite', () => {
  test('invites without a role when none was given and it cannot prompt', async () => {
    const { context, createOrganizationInvitation, selectPrompt } = buildContext();

    await implementation.call(context, { email: 'ada@example.com' });

    expect(selectPrompt).not.toHaveBeenCalled();
    expect(createOrganizationInvitation.mock.calls[0]?.[0].body).toStrictEqual({ email: 'ada@example.com' });
  });
});
