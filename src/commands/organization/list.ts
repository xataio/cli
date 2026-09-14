import { buildCommand } from '@stricli/core';

import type { LocalContext } from '~/context';

export async function implementation(this: LocalContext) {
  const { organizations } = await this.api.organizations.getOrganizationsList({});

  this.printTable(
    this,
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
    flags: {}
  },
  func: implementation
});
