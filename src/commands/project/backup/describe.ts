import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  project?: string;
  backup: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });

  const backup = await this.api.projects.getBackup({
    pathParams: { organizationID: organizationId, projectID: projectId, backupID: flags.backup }
  });

  this.print(
    this,
    flags.json,
    backup,
    ['ID', 'Branch ID', 'Earliest Restore', 'Description'],
    [[backup.id, backup.branchID, backup.earliestRestore || 'unknown', backup.description]]
  );
}

export const BackupDescribeCommand = buildCommand({
  docs: {
    brief: 'Describe a specific backup'
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
      backup: {
        kind: 'parsed',
        brief: 'Backup ID',
        parse: String,
        optional: false
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
