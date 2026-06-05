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
  const branchId = await this.getBranch(this, flags, { organizationId, projectId });

  // TODO: Temporary workaround - listBackups endpoint is not supported right now.
  // Using getBackup with the branch ID as the backup ID, returning a single-item array.
  const backup = await this.api.projects.getBackup({
    pathParams: { organizationID: organizationId, projectID: projectId, backupID: branchId }
  });

  const backups = [backup];

  this.print(
    this,
    flags.json,
    backups,
    ['backup_id', 'branch_id', 'earliest_restore', 'description'],
    backups.map((b) => [b.id, b.branchID, b.earliestRestore || 'unknown', b.description])
  );
}

export const BackupListCommand = buildCommand({
  docs: {
    brief: 'List all backups in a project'
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
        brief: 'Filter backups by branch ID',
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
