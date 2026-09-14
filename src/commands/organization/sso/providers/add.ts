import { buildCommand } from '@stricli/core';
import type { Types } from '@xata.io/api';
import { SSO_PROVIDER_PRESETS, SSO_PROVIDER_TYPES, ssoIssuerSchema, ssoRedirectUri } from '@xata.io/utils';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithError, printCustom } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  type: Types.OrganizationSSOProviderType;
  domain?: string;
  'issuer-url'?: string;
  'client-id'?: string;
  'client-secret'?: string;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationID = await this.getOrganization(this, flags, {});
  const preset = SSO_PROVIDER_PRESETS[flags.type];

  const domain = await this.enquirer.inputPrompt(this.isInteractive, 'Verified domain to connect', {
    flag: flags.domain
  });
  const issuer = preset.issuer
    ? undefined
    : await this.enquirer.inputPrompt(this.isInteractive, `Issuer URL (${preset.issuerPlaceholder})`, {
        flag: flags['issuer-url']
      });
  const clientId = await this.enquirer.inputPrompt(this.isInteractive, 'Client ID', { flag: flags['client-id'] });
  const clientSecret =
    flags['client-secret'] ??
    this.env.XATA_SSO_CLIENT_SECRET ??
    (await this.enquirer.inputPrompt(this.isInteractive, 'Client secret'));

  if (!domain || !clientId || !clientSecret) {
    return exitWithError(
      this,
      'Domain, client ID and client secret are required. Pass them as flags in a non-interactive shell.'
    );
  }
  if (issuer !== undefined && !ssoIssuerSchema.safeParse(issuer).success) {
    return exitWithError(
      this,
      `An https:// issuer URL is required for --type ${flags.type}. Pass it with --issuer-url.`
    );
  }

  const provider = await this.api.organizations.createOrganizationSSOProvider({
    pathParams: { organizationID },
    body: { type: flags.type, domain, client_id: clientId, client_secret: clientSecret, ...(issuer ? { issuer } : {}) }
  });

  printCustom(this, provider, () => {
    this.process.stdout.write(
      `${chalk.green(`✓ Connected ${provider.display_name} for ${provider.domain}`)}\n\nRedirect URI to register in ${preset.consoleName}:\n\n  ${ssoRedirectUri(this.apiIssuer, provider.alias)}\n\nRequire it with ${chalk.bold.italic(`xata organization sso providers enforce ${provider.alias}`)}\n`
    );
  });
}

export const OrganizationSsoProvidersAddCommand = buildCommand({
  docs: {
    brief: 'Connect an identity provider to a verified domain',
    fullDescription: `Reads the client secret from --client-secret, the XATA_SSO_CLIENT_SECRET environment variable, or a prompt, so it need not appear in shell history. Provider types: ${SSO_PROVIDER_TYPES.map((type) => `${type} (${SSO_PROVIDER_PRESETS[type].label})`).join(', ')}. Every type except google needs --issuer-url.`
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      type: {
        kind: 'enum',
        brief: 'Provider type',
        values: SSO_PROVIDER_TYPES,
        default: 'google'
      },
      domain: {
        kind: 'parsed',
        brief: 'Verified domain this provider signs in',
        parse: String,
        optional: true
      },
      'issuer-url': {
        kind: 'parsed',
        brief: 'Issuer URL, required for every type except google',
        parse: String,
        optional: true
      },
      'client-id': {
        kind: 'parsed',
        brief: 'Client ID issued by the identity provider',
        parse: String,
        optional: true
      },
      'client-secret': {
        kind: 'parsed',
        brief: 'Client secret issued by the identity provider',
        parse: String,
        optional: true
      }
    }
  },
  func: implementation
});
