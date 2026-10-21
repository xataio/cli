import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { formatEarliestRestore, formatLatestRestore } from './restore-utils';
import { describeSchedule, scheduleFromBackupTime } from './schedule';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const [backup, branch] = await Promise.all([
    this.api.projects.getBackup({
      pathParams: { organizationID: organizationId, projectID: projectId, backupID: branchId }
    }),
    this.api.branches.describeBranch({
      pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
    })
  ]);

  const retentionDays = branch.backupConfiguration?.retentionPeriod;
  const schedule = branch.backupConfiguration
    ? scheduleFromBackupTime(branch.backupConfiguration.backupTime)
    : undefined;
  const scheduleText = schedule ? describeSchedule(schedule) : 'unknown';

  this.printDetails(
    this,
    {
      backupId: backup.id,
      branchId: backup.branchID,
      earliestRestore: backup.earliestRestore ?? null,
      latestRestore: backup.latestRestore ?? null,
      retentionDays: retentionDays ?? null,
      schedule: schedule ?? null
    },
    [
      ['backup_id', backup.id],
      ['branch', backup.branchID],
      ['earliest_restore', formatEarliestRestore(backup.earliestRestore)],
      ['latest_restore', formatLatestRestore(backup.latestRestore)],
      ['retention_days', retentionDays === undefined ? 'unknown' : String(retentionDays)],
      ['schedule', scheduleText]
    ]
  );
}

export const BackupStatusCommand = buildCommand({
  docs: {
    brief: 'Show backup status for a branch',
    fullDescription:
      'Shows the recovery window (earliest and latest restore times, in UTC), retention and backup schedule of a branch. The backup ID is the branch ID.'
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
        brief: 'Branch ID or name to show backup status for',
        parse: String,
        optional: true
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Branch ID or name to show backup status for',
          placeholder: 'branch',
          parse: String,
          optional: true
        }
      ] as const
    }
  },
  func: implementation
});
