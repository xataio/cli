import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { formatUtc } from './format';

type Flags = {
  organization?: string;
  project?: string;
  backup?: string;
  branch?: string;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  if (flags.backup && (flags.branch || branchName)) {
    this.process.stderr.write('Error: Pass either --backup or a branch, not both\n');
    this.process.exit(1);
    return;
  }

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const backupId = flags.backup
    ? flags.backup
    : await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const backup = await this.api.projects.getBackup({
    pathParams: { organizationID: organizationId, projectID: projectId, backupID: backupId }
  });

  this.printDetails(
    this,
    {
      backupId: backup.id,
      branchId: backup.branchID,
      earliestRestore: backup.earliestRestore ?? null,
      latestRestore: backup.latestRestore ?? null,
      description: backup.description
    },
    [
      ['backup_id', backup.id],
      ['branch', backup.branchID],
      ['earliest_restore', formatUtc(backup.earliestRestore)],
      ['latest_restore', formatUtc(backup.latestRestore)],
      ['description', backup.description]
    ]
  );
}

export const BackupDescribeCommand = buildCommand({
  docs: {
    brief: 'Describe a specific backup',
    fullDescription:
      'The backup ID is the ID of the branch it belongs to, so --backup and --branch are interchangeable.'
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
        brief: 'Backup ID (the same as the branch ID)',
        parse: String,
        optional: true
      },
      branch: {
        kind: 'parsed',
        brief: 'Branch ID or name whose backup to describe',
        parse: String,
        optional: true
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Branch ID or name whose backup to describe',
          placeholder: 'branch',
          parse: String,
          optional: true
        }
      ] as const
    }
  },
  func: implementation
});
