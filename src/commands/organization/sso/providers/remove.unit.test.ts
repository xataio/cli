import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { implementation } from './remove';

function buildContext({ enforced, confirmed = true }: { enforced: boolean; confirmed?: boolean }) {
  const stdout: string[] = [];
  const deleteOrganizationSSOProvider = mock(async () => undefined);
  const confirmPrompt = mock(async (_isInteractive: boolean, _message: string) => confirmed);

  const context = {
    api: {
      organizations: {
        getOrganizationSSO: mock(async () => ({
          domains: [],
          providers: [{ alias: 'sso-org-acme-com', domain: 'acme.com', enforced }]
        })),
        deleteOrganizationSSOProvider
      }
    },
    process: { stdout: { write: (value: string) => stdout.push(value) } },
    isInteractive: true,
    outputJson: true,
    getOrganization: mock(async () => 'org-id'),
    enquirer: { inputPrompt: mock(async () => 'sso-org-acme-com'), confirmPrompt }
  } as unknown as LocalContext;

  return { context, stdout, deleteOrganizationSSOProvider, confirmPrompt };
}

const confirmation = (prompt: ReturnType<typeof buildContext>['confirmPrompt']) => prompt.mock.calls[0]?.[1] ?? '';

describe('organization sso providers remove', () => {
  test('warns about other sign-in methods when SSO is required', async () => {
    const { context, confirmPrompt, deleteOrganizationSSOProvider } = buildContext({ enforced: true });

    await implementation.call(context, { yes: false }, 'sso-org-acme-com');

    expect(confirmation(confirmPrompt)).toContain('go back to their other sign-in methods');
    expect(confirmation(confirmPrompt)).not.toContain('with a password');
    expect(deleteOrganizationSSOProvider).toHaveBeenCalledTimes(1);
  });

  test('keeps the warning neutral when SSO is optional', async () => {
    const { context, confirmPrompt } = buildContext({ enforced: false });

    await implementation.call(context, { yes: false }, 'sso-org-acme-com');

    expect(confirmation(confirmPrompt)).toBe(
      'Disconnect sso-org-acme-com? Members on its domain can no longer sign in through it.'
    );
  });

  test('leaves the provider connected without confirmation', async () => {
    const { context, deleteOrganizationSSOProvider } = buildContext({ enforced: true, confirmed: false });

    const result = await implementation.call(context, { yes: false }, 'sso-org-acme-com');

    expect(result).toBeInstanceOf(Error);
    expect(deleteOrganizationSSOProvider).not.toHaveBeenCalled();
  });

  test('skips the lookup and the prompt with --yes', async () => {
    const { context, confirmPrompt, stdout } = buildContext({ enforced: true });

    await implementation.call(context, { yes: true }, 'sso-org-acme-com');

    expect(confirmPrompt).not.toHaveBeenCalled();
    expect(context.api.organizations.getOrganizationSSO).not.toHaveBeenCalled();
    expect(JSON.parse(stdout.join(''))).toEqual({ success: true, provider: 'sso-org-acme-com' });
  });
});
