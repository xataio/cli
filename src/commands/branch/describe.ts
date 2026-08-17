import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  this.print(
    this,
    flags.json,
    branch,
    [
      'branch_id',
      'created_at',
      'instance_type',
      'name',
      'parent_id',
      'replicas',
      'status',
      'status_type',
      'scale_to_zero',
      'inactivity_minutes'
    ],
    [
      [
        branch.id,
        branch.createdAt,
        branch.configuration.instanceType,
        branch.name,
        branch.parentID || '',
        branch.configuration.replicas.toString(),
        branch.status.status,
        branch.status.statusType,
        branch.scaleToZero.enabled.toString(),
        branch.scaleToZero.inactivityPeriodMinutes.toString()
      ]
    ]
  );
}

export const BranchDescribeCommand = buildCommand({
  docs: {
    brief: 'Describe a branch'
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
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'The branch to describe',
          parse: String,
          placeholder: 'branch',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
