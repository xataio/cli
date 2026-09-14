import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithError, printCustom } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  yes: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, domainArg?: string) {
  const organizationID = await this.getOrganization(this, flags, {});
  const domain = await this.enquirer.inputPrompt(this.isInteractive, 'Domain to remove', { flag: domainArg });
  if (!domain) {
    return exitWithError(this, 'A domain is required.');
  }

  if (!flags.yes) {
    const confirmed = await this.enquirer.confirmPrompt(this.isInteractive, `Remove ${domain} from this organization?`);
    if (!confirmed) {
      return new Error('Aborted as there was no confirmation. Domain not removed.');
    }
  }

  await this.api.organizations.deleteOrganizationSSODomain({ pathParams: { organizationID, domain } });

  printCustom(this, { success: true, domain }, () => {
    this.process.stdout.write(chalk.green(`✓ Removed ${domain}\n`));
  });
}

export const OrganizationSsoDomainsRemoveCommand = buildCommand({
  docs: {
    brief: 'Remove a claimed domain from an organization'
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
          brief: 'Domain to remove, such as acme.com',
          parse: String,
          placeholder: 'domain',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
