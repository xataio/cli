import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

type Flags = {
  name: string;
};

export async function implementation(this: LocalContext, { name: organizationName }: Flags) {
  const organization = await this.api.organizations.createOrganization({
    body: { name: organizationName }
  });

  this.printDetails(this, organization, [
    ['organization_id', organization.id],
    ['name', organization.name]
  ]);
}

export const OrganizationCreateCommand = buildCommand({
  docs: {
    brief: 'Create a new organization'
  },
  parameters: {
    flags: {
      name: {
        kind: 'parsed',
        brief: 'Organization Name',
        parse: String,
        optional: false
      }
    }
  },
  func: implementation
});
