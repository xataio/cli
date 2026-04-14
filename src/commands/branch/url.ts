import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import type { Types } from '@xata.io/api';
import { buildConnectionString } from '@xata.io/sql';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
  type: 'primary' | 'primary-or-replica' | 'replica';
};

export function mapTypeToConnectionSuffix(type: 'primary' | 'primary-or-replica' | 'replica'): Types.EndpointType {
  switch (type) {
    case 'primary':
      return 'rw';
    case 'primary-or-replica':
      return 'r';
    case 'replica':
      return 'ro';
  }
}

export function validateBranchStatusForUrl(ctx: LocalContext, branch: Types.BranchMetadata): boolean {
  const statusType = branch.status.statusType;

  if (statusType === 'STATUS_TYPE_HEALTHY' || statusType === 'STATUS_TYPE_HIBERNATED') {
    return true;
  }

  const msg =
    statusType === 'STATUS_TYPE_FAULT'
      ? `The branch is unhealthy (statusType=${statusType}). Please use ${chalk.bold(`${CLI_NAME} branch wait-ready --wake`)} to wait for the branch to become healthy, or investigate the fault.`
      : `The branch is not ready. Please use ${chalk.bold(`${CLI_NAME} branch wait-ready`)} to wait for this branch to be ready.`;

  ctx.process.stderr.write(`${msg}\n`);
  return false;
}

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  if (!validateBranchStatusForUrl(this, branch)) {
    return;
  }

  const database = await this.getDatabase(this, flags);
  invariant(branch.connectionString, 'Branch should have a connection string at this point.');

  const endpointType = mapTypeToConnectionSuffix(flags.type);
  const connectionString = buildConnectionString(branch.connectionString, {
    database,
    endpointType
  });
  if (flags.type === 'replica' && (!branch.configuration?.replicas || branch.configuration.replicas === 0)) {
    this.process.stderr.write(
      `Warning: Using read-only endpoint but the branch has no replicas. This endpoint will only work if the branch has 1 or more replicas.\n\n`
    );
  }

  this.process.stdout.write(connectionString);
}

export const BranchURLCommand = buildCommand({
  docs: {
    brief: 'Print URL (connection string) for a branch'
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
        brief: 'Branch ID',
        parse: String,
        optional: true
      },
      database: {
        kind: 'parsed',
        brief: 'Database name',
        parse: String,
        optional: true
      },
      type: {
        kind: 'enum',
        values: ['primary', 'primary-or-replica', 'replica'],
        brief:
          'Connection type: primary (direct access to the primary), primary-or-replica (routed access to primary or replicas), replica (read-only access to replicas only)',
        default: 'primary'
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'The branch to get URL for',
          parse: String,
          placeholder: 'branch name',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
