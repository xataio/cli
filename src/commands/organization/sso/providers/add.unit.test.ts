import { describe, expect, mock, test } from 'bun:test';
import type { Types } from '@xata.io/api';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { implementation } from './add';

class ExitCalled extends Error {}

type Flags = Parameters<typeof implementation>[0];

function buildContext({
  isInteractive = false,
  selected = '',
  secret = ''
}: {
  isInteractive?: boolean;
  selected?: string;
  secret?: string;
} = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const createOrganizationSSOProvider = mock(
    async ({ body }: { body: Types.CreateOrganizationSSOProviderRequest }) => ({
      alias: 'sso-org-acme-com',
      type: body.type,
      domain: body.domain,
      display_name: 'Acme',
      enforced: false
    })
  );
  const selectPrompt = mock(async (_isInteractive: boolean, _message: string, _choices: unknown[]) => selected);
  const inputPrompt = mock(
    async (_isInteractive: boolean, _message: string, { flag }: { flag?: string } = {}) => flag ?? ''
  );
  const passwordPrompt = mock(async (_isInteractive: boolean, _message: string) => secret);

  const context = {
    api: { organizations: { createOrganizationSSOProvider } },
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      exit: mock(() => {
        throw new ExitCalled();
      })
    },
    env: {},
    apiIssuer: 'https://auth.xata.io/realms/xata',
    isInteractive,
    outputJson: true,
    getOrganization: mock(async () => 'org-id'),
    enquirer: { selectPrompt, inputPrompt, passwordPrompt }
  } as unknown as LocalContext;

  return { context, stdout, stderr, createOrganizationSSOProvider, selectPrompt, inputPrompt, passwordPrompt };
}

async function run(context: LocalContext, flags: Flags) {
  try {
    await implementation.call(context, flags);
  } catch (error) {
    if (!(error instanceof ExitCalled)) throw error;
  }
}

const credentials = { domain: 'acme.com', 'client-id': 'client' };

describe('organization sso providers add', () => {
  test('asks for the provider type in a terminal', async () => {
    const { context, createOrganizationSSOProvider, selectPrompt } = buildContext({
      isInteractive: true,
      selected: 'google'
    });

    await run(context, { ...credentials, 'client-secret': 'secret' });

    expect(selectPrompt.mock.calls[0]?.[2]).toEqual([
      { name: 'google', message: 'Google Workspace' },
      { name: 'microsoft', message: 'Microsoft Entra ID' },
      { name: 'oidc', message: 'OpenID Connect' }
    ]);
    expect(createOrganizationSSOProvider.mock.calls[0]?.[0].body.type).toBe('google');
  });

  test('requires --type when it cannot prompt', async () => {
    const { context, stderr, createOrganizationSSOProvider } = buildContext();

    await run(context, { ...credentials, 'client-secret': 'secret' });

    expect(stripAnsi(stderr.join(''))).toBe(
      'A provider type is required. Pass --type <google|microsoft|oidc> in a non-interactive shell.\n'
    );
    expect(createOrganizationSSOProvider).not.toHaveBeenCalled();
  });

  test('does not prompt for a type passed as a flag', async () => {
    const { context, selectPrompt, createOrganizationSSOProvider } = buildContext({ isInteractive: true });

    await run(context, {
      ...credentials,
      type: 'oidc',
      'issuer-url': 'https://acme.okta.com',
      'client-secret': 'secret'
    });

    expect(selectPrompt).not.toHaveBeenCalled();
    expect(createOrganizationSSOProvider.mock.calls[0]?.[0].body).toEqual({
      type: 'oidc',
      domain: 'acme.com',
      client_id: 'client',
      client_secret: 'secret',
      issuer: 'https://acme.okta.com'
    });
  });

  test('reads the client secret without echoing it', async () => {
    const { context, passwordPrompt, inputPrompt, createOrganizationSSOProvider } = buildContext({
      isInteractive: true,
      secret: 'typed-secret'
    });

    await run(context, { ...credentials, type: 'google' });

    expect(passwordPrompt).toHaveBeenCalledTimes(1);
    expect(inputPrompt.mock.calls.map((call) => call[1])).not.toContain('Client secret');
    expect(createOrganizationSSOProvider.mock.calls[0]?.[0].body.client_secret).toBe('typed-secret');
  });
});
