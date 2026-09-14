import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithError, printCustom } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  disable: boolean;
  yes: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, aliasArg?: string) {
  const organizationID = await this.getOrganization(this, flags, {});
  const providerAlias = await this.enquirer.inputPrompt(this.isInteractive, 'Provider alias', { flag: aliasArg });
  if (!providerAlias) {
    return exitWithError(this, 'A provider alias is required.');
  }

  const enforced = !flags.disable;
  if (enforced && !flags.yes) {
    const confirmed = await this.enquirer.confirmPrompt(
      this.isInteractive,
      `Require SSO through ${providerAlias}? Members on its domain will no longer be able to sign in with a password.`
    );
    if (!confirmed) {
      return new Error('Aborted as there was no confirmation. Enforcement unchanged.');
    }
  }

  const provider = await this.api.organizations.setOrganizationSSOProviderEnforcement({
    pathParams: { organizationID, providerAlias },
    body: { enforced }
  });

  printCustom(this, provider, () => {
    this.process.stdout.write(
      chalk.green(
        provider.enforced
          ? `✓ SSO is now required for ${provider.domain}\n`
          : `✓ SSO is no longer required for ${provider.domain}\n`
      )
    );
  });
}

export const OrganizationSsoProvidersEnforceCommand = buildCommand({
  docs: {
    brief: 'Require members on a domain to sign in through its identity provider',
    fullDescription:
      'Members on the domain lose the password form and the shared Google and GitHub buttons, so check the provider works before requiring it. Pass --disable to lift the requirement.'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      disable: {
        kind: 'boolean',
        brief: 'Stop requiring SSO instead of requiring it',
        default: false
      },
      yes: {
        kind: 'boolean',
        brief: 'Do not ask for confirmation, assume yes.',
        default: false
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
