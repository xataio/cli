import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

type Flags = {
  name: string;
  json: boolean;
};

export async function implementation(this: LocalContext, { name: organizationName, json }: Flags) {
  const organization = await this.api.organizations.createOrganization({
    body: { name: organizationName }
  });

  this.print(
    this,
    json,
    organization,
    ['Organization ID', 'Organization Name'],
    [[organization.id, organization.name]]
  );
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
