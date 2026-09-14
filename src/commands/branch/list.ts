import { buildCommand } from '@stricli/core';

import type { LocalContext } from '~/context';
import { writeNoBranchesInProject } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, skipPrompt: true });

  const { branches } = await this.api.branches.listBranches({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  if (branches.length === 0) {
    writeNoBranchesInProject(this);
    if (!this.outputJson) {
      return;
    }
  }

  const currentBranch = branches.find((branch) => branch.id === branchId);
  const rows = branches.map((branch) => ({ ...branch, current: currentBranch?.id === branch.id }));

  this.printTable(
    this,
    rows,
    ['branch_id', 'created_at', 'name', 'description', 'parent_id', 'current'],
    rows.map((branch) => [
      branch.id,
      branch.createdAt,
      branch.name,
      branch.description ?? '-',
      branch.parentID ?? '-',
      String(branch.current)
    ])
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
      }
    }
  },
  func: implementation
});
