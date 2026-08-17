import { buildCommand } from '@stricli/core';

import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;

  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, skipPrompt: true });

  const { branches } = await this.api.branches.listBranches({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const currentBranch = branches.find((branch) => branch.id === branchId);

  this.print(
    this,
    flags.json,
    branches,
    ['branch_id', 'created_at', 'name', 'parent_id', 'current'],
    branches.map((branch) => {
      const current = currentBranch?.id === branch.id ? 'true' : 'false';
      return [branch.id, branch.createdAt, branch.name, branch.parentID || '-', current];
    })
  );
}

export const BranchListCommand = buildCommand({
  docs: {
    brief: 'List all branches'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      project: {
        kind: 'parsed',
        brief: 'Project ID',
        parse: String,
        optional: true
      },
      branch: {
        kind: 'parsed',
        brief: 'Branch ID or name',
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
