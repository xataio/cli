import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithError, printCustom } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  yes: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, aliasArg?: string) {
  const organizationID = await this.getOrganization(this, flags, {});
  const providerAlias = await this.enquirer.inputPrompt(this.isInteractive, 'Provider alias to disconnect', {
    flag: aliasArg
  });
  if (!providerAlias) {
    return exitWithError(this, 'A provider alias is required.');
  }

  if (!flags.yes) {
    const confirmed = await this.enquirer.confirmPrompt(
      this.isInteractive,
      `Disconnect ${providerAlias}? Members on its domain will be able to sign in with a password again.`
    );
    if (!confirmed) {
      return new Error('Aborted as there was no confirmation. Identity provider not disconnected.');
    }
  }

  await this.api.organizations.deleteOrganizationSSOProvider({ pathParams: { organizationID, providerAlias } });

  printCustom(this, { success: true, provider: providerAlias }, () => {
    this.process.stdout.write(chalk.green(`✓ Disconnected ${providerAlias}\n`));
  });
}

export const OrganizationSsoProvidersRemoveCommand = buildCommand({
  docs: {
    brief: 'Disconnect an identity provider from an organization'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
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
