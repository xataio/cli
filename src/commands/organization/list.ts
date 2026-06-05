import { buildCommand } from '@stricli/core';

import type { LocalContext } from '~/context';

type Flags = {
  json: boolean;
};

export async function implementation(this: LocalContext, { json }: Flags) {
  const { organizations } = await this.api.organizations.getOrganizationsList({});

  this.print(
    this,
    json,
    organizations,
    ['organization_id', 'name'],
    organizations.map((p) => [p.id, p.name])
  );
}

export const OrganizationListCommand = buildCommand({
  docs: {
    brief: 'List all organizations'
  },
  parameters: {
    flags: {
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    }
  },
  func: implementation
});
