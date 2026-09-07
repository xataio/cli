import { buildCommand } from '@stricli/core';
import { fetchBranchConnectionString } from '@xata.io/sql';
import type { LocalContext } from '~/context';
import {
  getReplicaConnectionWarning,
  mapTypeToConnectionSuffix,
  type BranchConnectionType,
  validateBranchStatusForUrl
} from '~/lib/branch-connection';

export { validateBranchStatusForUrl } from '~/lib/branch-connection';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
  type: BranchConnectionType;
};

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

  const database = await this.getDatabase(flags);

  const endpointType = mapTypeToConnectionSuffix(flags.type);
  const connectionString = await fetchBranchConnectionString(
    this.api,
    { organizationID: organizationId, projectID: projectId, branchID: branchId },
    { database, endpointType }
  );
  const warning = getReplicaConnectionWarning(flags.type, branch);
  if (warning) {
    this.process.stderr.write(`${warning}\n\n`);
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
        brief: 'Branch ID or name',
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
          placeholder: 'branch',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
