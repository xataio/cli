import { buildCommand } from '@stricli/core';

import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});

  const { projects } = await this.api.projects.listProjects({ pathParams: { organizationID: organizationId } });

  this.printTable(
    this,
    projects,
    ['project_id', 'created_at', 'updated_at', 'name'],
    projects.map((p) => [p.id, p.createdAt, p.updatedAt, p.name])
  );
}

export const ProjectListCommand = buildCommand({
  docs: {
    brief: 'List all projects'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      }
    }
  },
  func: implementation
});
