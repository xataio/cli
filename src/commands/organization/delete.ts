import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;

  json: boolean;
  yes: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});

  const organization = await this.api.organizations.getOrganization({
    pathParams: { organizationID: organizationId }
  });

  if (!flags.yes) {
    const confirmFromPrompt = await this.enquirer.confirmPrompt(
      this.isCI,
      `Are you sure you want to delete the organization ${organization.name}?`
    );
    if (!confirmFromPrompt) {
      this.process.stdout.write(`Aborted as there was no confirmation. Organzation not deleted.`);
      return;
    }
  }

  if (!organization) {
    this.process.stderr.write(chalk.red(`Organization ${organization} not found.`));
    this.process.exit(1);
  }
  await this.api.organizations.deleteOrganization({
    pathParams: { organizationID: organizationId }
  });

  this.print(this, flags.json, organization, ['Deleted organization'], [[organization.name]]);
}

export const OrganizationDeleteCommand = buildCommand({
  docs: {
    brief: 'Delete a Organization'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      },
      yes: {
        kind: 'boolean',
        brief: 'Do not ask for confirmation, assume yes.',
        default: false
      }
    }
  },
  func: implementation
});
