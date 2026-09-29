import { describe, expect, mock, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { implementation } from './show';

function buildContext() {
  const stdout: string[] = [];
  const context = {
    api: {
      organizations: {
        getOrganizationSSO: mock(async () => ({
          domains: [
            {
              domain: 'acme.com',
              verified: false,
              provider_alias: 'sso-org-acme-com',
              verification: {
                record_type: 'TXT',
                record_name: '_xata-verification.acme.com',
                record_value: 'xata-verification=abc'
              }
            }
          ],
          providers: []
        }))
      }
    },
    process: { stdout: { write: (value: string) => stdout.push(value) } },
    apiIssuer: 'https://auth.xata.io/realms/xata',
    outputJson: false,
    getOrganization: mock(async () => 'org-id')
  } as unknown as LocalContext;

  return { context, stdout };
}

describe('organization sso show', () => {
  test('prints the TXT record name next to its value', async () => {
    const { context, stdout } = buildContext();

    await implementation.call(context, {});

    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('txt_name');
    expect(output).toContain('_xata-verification.acme.com');
    expect(output).toContain('xata-verification=abc');
  });
});
