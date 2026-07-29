import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { DEFAULT_MIGRATIONS_DIRECTORY } from '~/lib/constants';
import { getPgRoll } from '~/lib/pgroll/binary';
import { checkMigrationsDirectory } from './migrate';
import { buildCredentialsConnectionString, fetchBranchCredentials } from '@xata.io/sql';
import { mapTypeToConnectionSuffix, validateBranchStatusForUrl } from '../branch/url';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
  'migrations-folder'?: string;
  type: 'primary' | 'primary-or-replica' | 'replica';
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const targetDir = flags['migrations-folder'] || DEFAULT_MIGRATIONS_DIRECTORY;
  checkMigrationsDirectory(this, targetDir);

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  if (!validateBranchStatusForUrl(this, branch)) {
    return;
  }

  const credentials = await fetchBranchCredentials(this.api, {
    organizationID: organizationId,
    projectID: projectId,
    branchID: branchId
  });

  let latestSchema = '';
  try {
    const binary = await getPgRoll(this);

    // TODO(roll-url): do we need to support latest schema from remote case?
    const r = Bun.spawnSync([
      binary,
      'latest',
      'schema',
      '--postgres-url',
      buildCredentialsConnectionString(credentials),
      '--local',
      targetDir
    ]);
    latestSchema = r.stdout.toString().trim();
  } catch (e) {
    console.error(e);
  }

  const database = await this.getDatabase(this, flags);

  const endpointType = mapTypeToConnectionSuffix(flags.type);
  const connectionString = buildCredentialsConnectionString(credentials, {
    database,
    searchPath: latestSchema,
    endpointType
  });
  if (flags.type === 'replica' && (!branch.configuration?.replicas || branch.configuration.replicas === 0)) {
    this.process.stderr.write(
      `Warning: Using read-only endpoint but the branch has no replicas. This endpoint will only work if the branch has 1 or more replicas.\n\n`
    );
  }

  this.process.stdout.write(connectionString);
}

export const RollURLCommand = buildCommand({
  docs: {
    brief: 'Get schema aware database URL for the current branch'
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
      'migrations-folder': {
        kind: 'parsed',
        brief: 'Migrations folder',
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
