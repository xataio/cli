import { buildCommand } from '@stricli/core';
import { ssoTestSignInUrl } from '@xata.io/utils';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithError, printCustom } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
};

export async function implementation(this: LocalContext, flags: Flags, aliasArg?: string) {
  const organizationID = await this.getOrganization(this, flags, {});
  const providerAlias = await this.enquirer.inputPrompt(this.isInteractive, 'Provider alias to test', {
    flag: aliasArg
  });
  if (!providerAlias) {
    return exitWithError(this, 'A provider alias is required.');
  }

  const { domains, providers } = await this.api.organizations.getOrganizationSSO({ pathParams: { organizationID } });
  const provider = providers.find((provider) => provider.alias === providerAlias);
  if (!provider) {
    return exitWithError(this, `No identity provider ${providerAlias} in this organization.`);
  }
  if (!domains.find((domain) => domain.domain === provider.domain)?.verified) {
    return exitWithError(this, `${provider.domain} is not verified, so ${providerAlias} is paused until it is.`);
  }

  const url = ssoTestSignInUrl(this.apiIssuer, provider.alias);

  printCustom(this, { provider: provider.alias, domain: provider.domain, url }, () => {
    this.process.stdout.write(
      `Open this link in a private window and sign in with an account on ${provider.domain}:\n\n  ${url}\n\n${chalk.gray('Opening it where you are signed in to Xata does not test the provider.')}\n`
    );
  });
}

export const OrganizationSsoProvidersTestCommand = buildCommand({
  docs: {
    brief: 'Print a link that tests sign-in through an identity provider',
    fullDescription:
      'Members are only sent to a provider once SSO is required on its domain. The link signs in through the provider directly, so you can check it works before running `xata organization sso providers enforce`. Open it in a private window, since it signs that browser in as the account you test with.'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Provider alias, as shown by xata organization sso show',
          parse: String,
          placeholder: 'alias',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
