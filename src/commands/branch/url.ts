import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import type { Types } from '@xata.io/api';
import { fetchBranchConnectionString } from '@xata.io/sql';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
  type: 'primary' | 'primary-or-replica' | 'replica' | 'pooler';
};

export function mapTypeToConnectionSuffix(type: Flags['type']): Types.EndpointType {
  switch (type) {
    case 'primary':
      return 'rw';
    case 'primary-or-replica':
      return 'r';
    case 'replica':
      return 'ro';
    case 'pooler':
      return 'pooled_rw';
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

  const endpointType = mapTypeToConnectionSuffix(flags.type);
  const connectionString = await fetchBranchConnectionString(
    this.api,
    { organizationID: organizationId, projectID: projectId, branchID: branchId },
    { database, endpointType }
  );
  if (flags.type === 'replica' && (!branch.configuration?.replicas || branch.configuration.replicas === 0)) {
    this.process.stderr.write(
      `Warning: Using read-only endpoint but the branch has no replicas. This endpoint will only work if the branch has 1 or more replicas.\n\n`
    );
  }

  this.process.stdout.write(connectionString);
}

export const BranchURLCommand = buildCommand({
  docs: {
    brief: 'Print URL (connection string) for a branch',
    fullDescription:
      'Reads the connection details from the credentials endpoint, so an API key needs the `credentials:read` scope, see https://xata.io/docs/cli#required-scopes.',
    customUsage: [
      { input: 'main', brief: 'Print the primary connection string' },
      { input: 'main --type pooler', brief: 'Pooled connection string, for serverless workloads' },
      { input: 'main --type replica', brief: 'Read-only connection string that targets replicas' }
    ]
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
        values: ['primary', 'primary-or-replica', 'replica', 'pooler'],
        brief:
          'Connection type: primary (direct access to the primary), primary-or-replica (routed access to primary or replicas), replica (read-only access to replicas only, requires at least one replica), pooler (pooled access to the primary, recommended for serverless and high-concurrency workloads)',
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
