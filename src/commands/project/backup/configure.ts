import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { formatCronExpression, parseCronExpression } from '@xata.io/utils';
import chalk from 'chalk';
import { dayOfWeekMapReverse } from '@xata.io/utils';

type Flags = {
  organization?: string;
  project?: string;
  retention?: string;
  cadence?: string;
  'day-of-week'?: string;
  time?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, {}, { organizationId, projectId, branchName });

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

  if (!currentConfig.backupTime) {
    this.process.stderr.write(`Error: No backup time found for branch "${branchId}"\n`);
    this.process.exit(1);
    return;
  }

  if (!currentConfig.retentionPeriod) {
    this.process.stderr.write(`Error: No retention period found for branch "${branchId}"\n`);
    this.process.exit(1);
    return;
  }

  const current = parseCronExpression(currentConfig.backupTime);
  const currentRetention = currentConfig.retentionPeriod || 2;

  const hasConfigChanges = flags.retention || flags.cadence || flags['day-of-week'] || flags.time;

  // If no configuration flags passed, just show current configuration
  if (!hasConfigChanges) {
    if (flags.json) {
      this.process.stdout.write(
        `${JSON.stringify(
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
          null,
          2
        )}\n`
      );
    } else {
      this.process.stdout.write(`\n${chalk.bold('Backup Configuration')} for branch ${chalk.bold(branchId)}\n\n`);
      this.process.stdout.write(`  Retention: ${currentRetention} days\n`);
      this.process.stdout.write(`  Cadence:   ${current.cadence}`);
      if (current.cadence === 'weekly') {
        this.process.stdout.write(` (${current.dayOfWeek})`);
      }
      this.process.stdout.write(`\n`);
      this.process.stdout.write(`  Time:      ${current.time}\n`);
      this.process.stdout.write(`  Pattern:   ${currentConfig.backupTime}\n\n`);
    }
    return;
  }

  // Validation. Set defaults to current configuration
  let newCadence = current.cadence;
  let newDayOfWeek = current.cadence === 'weekly' ? current.dayOfWeek : 'monday';
  let newRetention = currentRetention;
  let newTime = current.time;

  if (flags.cadence) {
    if (flags.cadence !== 'daily' && flags.cadence !== 'weekly') {
      this.process.stderr.write('Error: Cadence must be either "daily" or "weekly"\n');
      this.process.exit(1);
      return;
    }

    newCadence = flags.cadence;

    // Cadence is set to weekly, so we need a day of week flag too.
    if (flags.cadence && flags.cadence === 'weekly') {
      if (!flags['day-of-week']) {
        this.process.stderr.write('Error: --day-of-week is required when setting cadence to weekly\n');
        this.process.exit(1);
        return;
      }
    }
  }

  if (flags['day-of-week']) {
    newDayOfWeek = flags['day-of-week'];
    const dayOfWeekIsValid = dayOfWeekMapReverse[newDayOfWeek];
    if (!dayOfWeekIsValid) {
      this.process.stderr.write(`Error: Invalid day of week: ${newDayOfWeek}\n`);
      this.process.exit(1);
      return;
    }
  }

  if (flags.retention) {
    newRetention = Number(flags.retention);
    if (newRetention < 2 || newRetention > 40) {
      this.process.stderr.write(`Error: Retention period must be between 2 and 40 days, got ${flags.retention}\n`);
      this.process.exit(1);
      return;
    }
    newRetention = Number(flags.retention);
  }

  if (flags.time) {
    newTime = flags.time;
  }

  const newBackupTime = formatCronExpression({
    cadence: newCadence,
    dayOfWeek: newDayOfWeek,
    time: newTime
  });

  if (!flags.json) {
    this.process.stdout.write(
      `\nUpdating backup schedule for branch ${chalk.bold(branchId)} in project ${chalk.bold(projectId)}...\n\n`
    );

    this.process.stdout.write(chalk.bold('Current settings:\n'));
    this.process.stdout.write(`  Retention: ${currentRetention} days\n`);
    this.process.stdout.write(`  Cadence:   ${current.cadence}`);
    if (current.cadence === 'weekly') {
      this.process.stdout.write(` (${current.dayOfWeek})`);
    }
    this.process.stdout.write(`\n`);
    this.process.stdout.write(`  Time:      ${current.time}\n\n`);

    this.process.stdout.write(chalk.bold('New settings:\n'));
    this.process.stdout.write(`  Retention: ${newRetention} days\n`);
    this.process.stdout.write(`  Cadence:   ${newCadence}`);
    if (newCadence === 'weekly') {
      this.process.stdout.write(` (${newDayOfWeek})`);
    }
    this.process.stdout.write(`\n`);
    this.process.stdout.write(`  Time:      ${newTime}\n\n`);
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

  if (flags.json) {
    this.process.stdout.write(
      `${JSON.stringify(
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
            cadence: newCadence,
            dayOfWeek: newDayOfWeek,
            time: newTime
          }
        },
        null,
        2
      )}\n`
    );
  } else {
    this.process.stdout.write(`${chalk.green('✔')} Backup configuration updated successfully.\n`);
  }
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
      retention: {
        kind: 'parsed',
        brief: 'Number of days to retain backups (2-40)',
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
        brief: 'Day of week for weekly backups (monday, tuesday, etc.)',
        parse: String,
        optional: true
      },
      time: {
        kind: 'parsed',
        brief: 'Backup time in 24-hour HH:MM format (e.g., 02:30)',
        parse: String,
        optional: true
      },
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Branch name to configure backups for',
          placeholder: 'branch-name',
          parse: String,
          optional: true
        }
      ] as const
    }
  },
  func: implementation
});
