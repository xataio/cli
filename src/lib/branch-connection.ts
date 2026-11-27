import type { Types } from '@xata.io/api';
import { buildCredentialsConnectionString } from '@xata.io/sql';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';

export type BranchConnectionType = 'primary' | 'primary-or-replica' | 'replica' | 'pooler';

export function mapTypeToConnectionSuffix(type: BranchConnectionType): Types.EndpointType {
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

export function getBranchUrlReadinessError(branch: Types.BranchMetadata): string | null {
  const statusType = branch.status.statusType;

  if (statusType === 'STATUS_TYPE_HEALTHY' || statusType === 'STATUS_TYPE_HIBERNATED') {
    return null;
  }

  if (statusType === 'STATUS_TYPE_FAULT') {
    return `The branch is unhealthy (statusType=${statusType}). Please use ${chalk.bold(`${CLI_NAME} branch wait-ready --wake`)} to wait for the branch to become healthy, or investigate the fault.`;
  }

  return `The branch is not ready. Please use ${chalk.bold(`${CLI_NAME} branch wait-ready`)} to wait for this branch to be ready.`;
}

export function validateBranchStatusForUrl(ctx: LocalContext, branch: Types.BranchMetadata): boolean {
  const error = getBranchUrlReadinessError(branch);
  if (!error) {
    return true;
  }

  ctx.process.stderr.write(`${error}\n`);
  return false;
}

export function getReplicaConnectionWarning(type: BranchConnectionType, branch: Types.BranchMetadata): string | null {
  const needsReplica = type === 'replica' || type === 'primary-or-replica';
  if (needsReplica && !branch.configuration?.replicas) {
    return `Warning: The ${type} endpoint needs a replica but the branch has none. It will only work once the branch has 1 or more replicas.`;
  }

  return null;
}

export function buildBranchConnectionString(
  credentials: Pick<Types.BranchCredentials, 'connectionString'>,
  options: { database?: string; type: BranchConnectionType; mask?: boolean; searchPath?: string }
) {
  return buildCredentialsConnectionString(credentials, {
    database: options.database,
    endpointType: mapTypeToConnectionSuffix(options.type),
    mask: options.mask,
    searchPath: options.searchPath
  });
}
