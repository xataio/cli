import { buildCommand } from '@stricli/core';
import chalk from 'chalk';

import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});

  const organization = await this.api.organizations.getOrganization({
    pathParams: { organizationID: organizationId }
  });
  if (!organization) {
    this.process.stderr.write(chalk.red(`Organization ${organizationId} not found.`));
    this.process.exit(1);
  }

  this.print(this, flags.json, organization, ['ID', 'Name'], [[organization.id, organization.name]]);
}

export const OrganizationDescribeCommand = buildCommand({
  docs: {
    brief: 'Describe a organization'
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
      }
    }
  },
  func: implementation
});
