import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { implementation } from './test';

class ExitError extends Error {}

function buildContext({ verified = true }: { verified?: boolean } = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const context = {
    api: {
      organizations: {
        getOrganizationSSO: mock(async () => ({
          domains: [{ domain: 'acme.com', verified, provider_alias: 'sso-org-acme-com' }],
          providers: [{ alias: 'sso-org-acme-com', domain: 'acme.com', enforced: false }]
        }))
      }
    },
    apiIssuer: 'https://auth.xata.io/realms/xata',
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      exit: () => {
        throw new ExitError();
      }
    },
    isInteractive: false,
    outputJson: true,
    getOrganization: mock(async () => 'org-id'),
    enquirer: {
      inputPrompt: mock(async (_isInteractive: boolean, _message: string, { flag }: { flag?: string }) => flag)
    }
  } as unknown as LocalContext;

  return { context, stdout, stderr };
}

describe('organization sso providers test', () => {
  test('prints a sign-in link that goes straight to the provider', async () => {
    const { context, stdout } = buildContext();

    await implementation.call(context, {}, 'sso-org-acme-com');

    const printed = JSON.parse(stdout.join(''));
    expect(printed).toMatchObject({ provider: 'sso-org-acme-com', domain: 'acme.com' });
    const url = new URL(printed.url);
    expect(url.origin + url.pathname).toBe('https://auth.xata.io/realms/xata/protocol/openid-connect/auth');
    expect(url.searchParams.get('kc_idp_hint')).toBe('sso-org-acme-com');
  });

  test('refuses a provider the organization does not have', async () => {
    const { context, stderr } = buildContext();

    await expect(implementation.call(context, {}, 'sso-org-other-com')).rejects.toBeInstanceOf(ExitError);
    expect(stderr.join('')).toContain('No identity provider sso-org-other-com');
  });

  test('refuses a provider whose domain is not verified', async () => {
    const { context, stderr, stdout } = buildContext({ verified: false });

    await expect(implementation.call(context, {}, 'sso-org-acme-com')).rejects.toBeInstanceOf(ExitError);
    expect(stderr.join('')).toContain('acme.com is not verified');
    expect(stdout).toEqual([]);
  });
});
