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

  const fields: [header: string, value: string][] = [
    ['branch_id', branch.id],
    ['created_at', branch.createdAt],
    ['updated_at', branch.updatedAt],
    ['instance_type', branch.configuration.instanceType],
    ['name', branch.name],
    ['description', branch.description ?? ''],
    ['parent_id', branch.parentID ?? ''],
    ['region', branch.region],
    ['replicas', branch.configuration.replicas.toString()],
    ['storage', branch.configuration.storage?.toString() ?? ''],
    ['status', branch.status.status],
    ['status_type', branch.status.statusType],
    ['scale_to_zero', branch.scaleToZero.enabled.toString()],
    ['inactivity_minutes', branch.scaleToZero.inactivityPeriodMinutes.toString()]
  ];

  this.print(
    this,
    flags.json,
    branch,
    fields.map(([header]) => header),
    [fields.map(([, value]) => value)]
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
