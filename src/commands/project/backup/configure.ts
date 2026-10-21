import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { printCustom } from '~/lib/cli-utils';
import chalk from 'chalk';
import {
  describeSchedule,
  parseConfigureFlags,
  resolveSchedule,
  scheduleFromBackupTime,
  toBackupTime,
  type ConfigureFlags
} from './schedule';

type Flags = ConfigureFlags & {
  organization?: string;
  project?: string;
  branch?: string;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const changes = parseConfigureFlags(flags);
  if ('error' in changes) {
    this.process.stderr.write(`Error: ${changes.error}\n`);
    this.process.exit(1);
    return;
  }

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });
  if (!branch.backupsEnabled) {
    this.process.stderr.write(`Error: Backups are not enabled for branch "${branchId}"\n`);
    this.process.exit(1);
    return;
  }

  if (!branch.backupConfiguration) {
    this.process.stderr.write(`Error: No backup configuration found for branch "${branchId}"\n`);
    this.process.exit(1);
    return;
  }

  const currentConfig = branch.backupConfiguration;

  if (!currentConfig.retentionPeriod) {
    this.process.stderr.write(`Error: No retention period found for branch "${branchId}"\n`);
    this.process.exit(1);
    return;
  }

  const currentRetention = currentConfig.retentionPeriod;
  const current = scheduleFromBackupTime(currentConfig.backupTime);

  if (Object.keys(changes).length === 0) {
    printCustom(
      this,
      {
        branchId,
        projectId,
        organizationId,
        backupsEnabled: branch.backupsEnabled,
        configuration: {
          retention: currentRetention,
          cadence: current.cadence,
          dayOfWeek: current.cadence === 'weekly' ? current.dayOfWeek : undefined,
          time: current.time,
          backupTime: currentConfig.backupTime
        }
      },
      () => {
        this.process.stdout.write(`\n${chalk.bold('Backup Configuration')} for branch ${chalk.bold(branchId)}\n\n`);
        this.process.stdout.write(`  Retention: ${currentRetention} days\n`);
        this.process.stdout.write(`  Schedule:  ${describeSchedule(current)}\n`);
        if (currentConfig.backupTime) {
          this.process.stdout.write(`  Pattern:   ${currentConfig.backupTime} (UTC)\n`);
        }
        this.process.stdout.write('\n');
      }
    );
    return;
  }

  const next = resolveSchedule(current, changes);
  if ('error' in next) {
    this.process.stderr.write(`Error: ${next.error}\n`);
    this.process.exit(1);
    return;
  }
  const newRetention = changes.retention ?? currentRetention;
  const newBackupTime = toBackupTime(next);

  if (!this.outputJson) {
    this.process.stdout.write(
      `\nUpdating backup schedule for branch ${chalk.bold(branchId)} in project ${chalk.bold(projectId)}...\n\n`
    );

    this.process.stdout.write(chalk.bold('Current settings:\n'));
    this.process.stdout.write(`  Retention: ${currentRetention} days\n`);
    this.process.stdout.write(`  Schedule:  ${describeSchedule(current)}\n\n`);

    this.process.stdout.write(chalk.bold('New settings:\n'));
    this.process.stdout.write(`  Retention: ${newRetention} days\n`);
    this.process.stdout.write(`  Schedule:  ${describeSchedule(next)}\n\n`);
  }

  await this.api.branches.updateBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId },
    body: {
      backupConfiguration: {
        backupTime: newBackupTime,
        retentionPeriod: newRetention
      }
    }
  });

  printCustom(
    this,
    {
      branchId,
      projectId,
      organizationId,
      previous: {
        retention: currentRetention,
        cadence: current.cadence,
        dayOfWeek: current.cadence === 'weekly' ? current.dayOfWeek : undefined,
        time: current.time
      },
      current: {
        retention: newRetention,
        cadence: next.cadence,
        dayOfWeek: next.cadence === 'weekly' ? next.dayOfWeek : undefined,
        time: next.time
      }
    },
    () => {
      this.process.stdout.write(`${chalk.green('✔')} Backup configuration updated successfully.\n`);
    }
  );
}

export const BackupConfigureCommand = buildCommand({
  docs: {
    brief: 'Configure PITR backup schedule for a branch'
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
        brief: 'Branch ID or name to configure backups for',
        parse: String,
        optional: true
      },
      retention: {
        kind: 'parsed',
        brief: 'Number of days to retain backups (2-35)',
        parse: String,
        optional: true
      },
      cadence: {
        kind: 'parsed',
        brief: 'Backup cadence (daily or weekly)',
        parse: String,
        optional: true
      },
      'day-of-week': {
        kind: 'parsed',
        brief: 'Day of week for weekly backups (monday, tuesday, etc.; optional when the branch is already weekly)',
        parse: String,
        optional: true
      },
      time: {
        kind: 'parsed',
        brief: 'Backup time in 24-hour HH:MM format, UTC (e.g., 02:30)',
        parse: String,
        optional: true
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Branch ID or name to configure backups for',
          placeholder: 'branch',
          parse: String,
          optional: true
        }
      ] as const
    }
  },
  func: implementation
});
